import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthedUser, planOf } from "./helpers";
import { internal } from "./_generated/api";

const r2 = (n: number) => Math.round(n * 100) / 100;

// Contract size used to turn a price move into dollars (1 lot XAUUSD = 100 oz).
const defaultContract = (symbol: string) => (/XAU|GOLD/i.test(symbol) ? 100 : /XAG|SILVER/i.test(symbol) ? 5000 : 100000);

// Recent alerts, so the user can see the connection working.
export const getSignals = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUser(ctx);
    const rows = await ctx.db.query("tvSignals").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(10);
    return rows.map((r) => ({ _id: r._id, at: r._creationTime, event: r.event, symbol: r.symbol, side: r.side, price: r.price, note: r.note }));
  },
});

// Handles one TradingView strategy alert. An "entry" is remembered; the matching "exit"
// returns a closed deal that the HTTP route journals through the same path as MT5.
export const ingest = internalMutation({
  args: {
    apiKey: v.string(),
    event: v.string(),
    symbol: v.string(),
    side: v.optional(v.string()),
    price: v.number(),
    sl: v.optional(v.number()),
    rr: v.optional(v.number()),
    lots: v.optional(v.number()),
    contract: v.optional(v.number()),
    time: v.number(),
  },
  handler: async (ctx, a) => {
    const user = await ctx.db.query("users").withIndex("by_mt5_key", (q) => q.eq("mt5ApiKey", a.apiKey)).first();
    if (!user || user.isBlocked) return { ok: false as const, reason: "invalid key" };
    if (planOf(user).plan === "starter") return { ok: false as const, reason: "plan required" };
    const symbol = a.symbol.replace(/^.*:/, "").toUpperCase();
    const log = (note?: string, side?: string) =>
      ctx.db.insert("tvSignals", { userId: user._id, event: a.event, symbol, side, price: a.price, note });

    const open = (await ctx.db.query("tvOpen").withIndex("by_user", (q) => q.eq("userId", user._id)).collect()).filter((o) => o.symbol === symbol);

    if (a.event === "entry") {
      const side = (a.side ?? "buy").toLowerCase().startsWith("s") ? "sell" : "buy";
      for (const o of open) await ctx.db.delete(o._id);
      const rr = a.rr ?? 2;
      const tp = a.sl != null ? r2(a.price + (a.price - a.sl) * rr) : undefined;
      await ctx.db.insert("tvOpen", {
        userId: user._id,
        symbol,
        side,
        price: a.price,
        sl: a.sl,
        tp,
        lots: a.lots ?? 1,
        contract: a.contract ?? defaultContract(symbol),
        time: a.time,
      });
      await log(a.sl != null ? `SL ${a.sl} · TP ${tp}` : undefined, side);
      await ctx.scheduler.runAfter(0, internal.pushSend.sendToUser, {
        userId: user._id,
        title: `${side === "buy" ? "🟢 BUY" : "🔴 SELL"} ${symbol} @ ${a.price}`,
        body: a.sl != null ? `Stop ${a.sl} · Target ${tp} (1:${rr})` : "TradingView entry alert",
        tag: `tv-entry-${a.time}`,
      });
      return { ok: true as const };
    }

    if (a.event === "exit") {
      const o = open[0];
      if (!o) {
        await log("exit without a matching entry — not journaled");
        return { ok: true as const };
      }
      await ctx.db.delete(o._id);
      const dir = o.side === "sell" ? -1 : 1;
      const profit = r2((a.price - o.price) * dir * o.lots * o.contract);
      await log(`closed ${profit >= 0 ? "+" : "-"}$${Math.abs(profit)}`, o.side);
      await ctx.scheduler.runAfter(0, internal.pushSend.sendToUser, {
        userId: user._id,
        title: `${profit >= 0 ? "✅ Profit" : "❌ Loss"} ${profit >= 0 ? "+" : "-"}$${Math.abs(profit)} · ${symbol}`,
        body: `${o.side.toUpperCase()} ${o.price} → ${a.price} · trade added to your journal`,
        tag: `tv-exit-${a.time}`,
      });
      return {
        ok: true as const,
        deal: {
          apiKey: a.apiKey,
          ticket: `tv-${symbol}-${o.time}-${a.time}`,
          symbol,
          type: o.side,
          volume: o.lots,
          openPrice: o.price,
          closePrice: a.price,
          openTime: o.time,
          closeTime: a.time,
          sl: o.sl,
          tp: o.tp,
          profit,
          source: "tradingview",
        },
      };
    }
    return { ok: false as const, reason: "unknown event" };
  },
});
