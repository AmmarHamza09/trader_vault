import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { planForVariant } from "./billing";

const http = httpRouter();

// Lemon Squeezy subscription events (created / updated / cancelled / expired …). Verified with HMAC-SHA256.
http.route({
  path: "/lemon/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    const raw = await request.text();
    const sig = request.headers.get("X-Signature") ?? "";
    if (!secret) return new Response("not configured", { status: 503 });
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
    const expected = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
    let diff = expected.length ^ sig.length;
    for (let i = 0; i < Math.min(expected.length, sig.length); i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    if (diff !== 0) return new Response("bad signature", { status: 401 });

    let body: any;
    try { body = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
    const event: string = body?.meta?.event_name ?? "";
    if (event.startsWith("subscription_") && !event.startsWith("subscription_payment")) {
      const at = body.data?.attributes ?? {};
      const ms = (d: any) => (d ? Date.parse(d) : undefined);
      await ctx.runMutation(internal.billing.applySubscription, {
        userId: body.meta?.custom_data?.user_id,
        subscriptionId: String(body.data?.id),
        customerId: String(at.customer_id ?? ""),
        status: String(at.status ?? "active"),
        plan: planForVariant(String(at.variant_id)),
        renewsAt: ms(at.renews_at),
        endsAt: ms(at.ends_at),
        portalUrl: at.urls?.customer_portal,
      });
    }
    return new Response("ok", { status: 200 });
  }),
});


auth.addHttpRoutes(http);

// Receives closed-trade events from the TraderVault MT5 Expert Advisor.
http.route({
  path: "/mt5/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    let b: any;
    try {
      b = await request.json();
    } catch {
      return json({ ok: false, reason: "bad json" }, 400);
    }
    const num = (x: any) => Number(x);
    if (!b?.apiKey || !b?.ticket || !b?.symbol) return json({ ok: false, reason: "missing fields" }, 400);
    const result = await ctx.runMutation(internal.mt5.ingestDeal, {
      apiKey: String(b.apiKey),
      ticket: String(b.ticket),
      symbol: String(b.symbol),
      type: String(b.type ?? "buy"),
      volume: num(b.volume),
      openPrice: num(b.openPrice),
      closePrice: num(b.closePrice),
      openTime: num(b.openTime),
      closeTime: num(b.closeTime),
      sl: b.sl != null ? num(b.sl) : undefined,
      tp: b.tp != null ? num(b.tp) : undefined,
      profit: num(b.profit),
      commission: b.commission != null ? num(b.commission) : undefined,
      swap: b.swap != null ? num(b.swap) : undefined,
    });
    return json(result, result.ok ? 200 : 401);
  }),
});

// Receives strategy / indicator alerts (TradingView, OpenMarket, anything that can POST JSON) and journals the closed trade.
http.route({
  path: "/tv/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    const raw = await request.text();
    // Rejected alerts are kept (key hidden) in System Health so you can see exactly what a sender posted.
    const reject = async (reason: string) => {
      const safe = raw.replace(/(\\?"apiKey\\?"\s*:\s*\\?")[^"\\]*/g, '$1***').slice(0, 220);
      await ctx.runMutation(internal.health.logError, { message: `Alert webhook rejected (${reason}): ${safe}` });
      return json({ ok: false, reason }, 400);
    };
    let b: any = null;
    try {
      b = JSON.parse(raw);
    } catch {
      b = null;
    }
    // Some senders wrap the alert text, e.g. {"message":"{...json...}"} — unwrap it.
    for (const k of ["message", "text", "body"]) {
      if (b && typeof b[k] === "string") {
        try {
          const inner = JSON.parse(b[k]);
          if (inner && typeof inner === "object") {
            b = inner;
            break;
          }
        } catch {
          /* not JSON */
        }
      }
    }
    if (!b || typeof b !== "object") return await reject("message is not valid JSON");
    const num = (x: any) => (x != null && x !== "" && isFinite(Number(x)) ? Number(x) : undefined);
    const price = num(b?.price);
    if (!b?.apiKey || !b?.symbol || !b?.event || price == null) return await reject("missing apiKey/symbol/event/price");
    const parsed = b.time ? Date.parse(String(b.time)) : NaN;
    const time = Math.floor((isFinite(parsed) ? parsed : Date.now()) / 1000);
    const res: any = await ctx.runMutation(internal.tradingview.ingest, {
      apiKey: String(b.apiKey),
      event: String(b.event).toLowerCase(),
      symbol: String(b.symbol),
      side: b.side != null ? String(b.side) : undefined,
      price,
      sl: num(b.sl),
      rr: num(b.rr),
      lots: num(b.lots),
      contract: num(b.contract),
      time,
    });
    if (!res.ok) return json(res, res.reason === "invalid key" ? 401 : 400);
    if (res.deal) {
      const out = await ctx.runMutation(internal.mt5.ingestDeal, res.deal);
      return json(out, out.ok ? 200 : 400);
    }
    return json({ ok: true });
  }),
});

// Browser crash / error reports (works even when the React app has crashed).
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
http.route({ path: "/client-error", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })) });
http.route({
  path: "/client-error",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const b: any = JSON.parse(await request.text());
      if (typeof b?.message === "string" && b.message.trim()) {
        await ctx.runMutation(internal.health.logError, {
          message: b.message,
          stack: typeof b.stack === "string" ? b.stack : undefined,
          url: typeof b.url === "string" ? b.url : undefined,
          ua: request.headers.get("user-agent") ?? undefined,
        });
      }
    } catch {
      /* ignore malformed reports */
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  }),
});

export default http;
