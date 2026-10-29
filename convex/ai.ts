"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";
import { api, internal } from "./_generated/api";

// Gemini models occasionally return 503 "high demand". Try each model in turn
// (with one short retry) so a single overloaded model doesn't break the feature.
const BASE_CHAIN = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"];
let MODEL_CHAIN = [...BASE_CHAIN];

// The 5-minute health checker ranks models by speed/availability; use that order when it is fresh.
async function primeModelOrder(ctx: { runQuery: (...a: any[]) => Promise<any> }) {
  try {
    const order: string[] | null = await ctx.runQuery(internal.health.aiOrder, {});
    MODEL_CHAIN = order?.length ? [...order, ...BASE_CHAIN.filter((m) => !order.includes(m))] : [...BASE_CHAIN];
  } catch {
    MODEL_CHAIN = [...BASE_CHAIN];
  }
}

// Abort a single model call that runs too long, so we fall through to the next model fast
// instead of hanging for minutes (vision calls can stall with the thinking pass on).
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
  });
}

export async function genWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  opts: { perCallMs?: number; sweeps?: number } = {}
) {
  const perCallMs = opts.perCallMs ?? 30000;
  const sweeps = opts.sweeps ?? 2;
  // Disable the slow "thinking" pass by default — these are structured extraction/critique
  // tasks, not reasoning puzzles, and thinking was making image calls take minutes.
  const cfg: any = { thinkingConfig: { thinkingBudget: 0 }, ...(params as any).config };
  let sawBusy = false;
  for (let sweep = 0; sweep < sweeps; sweep++) {
    for (const model of MODEL_CHAIN) {
      try {
        return await withTimeout(ai.models.generateContent({ ...params, model, config: cfg }), perCallMs);
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        if (!/500|503|504|UNAVAILABLE|429|RESOURCE_EXHAUSTED|quota|overloaded|high demand|404|NOT_FOUND|fetch failed|timeout/i.test(msg)) throw err;
        if (!/429|RESOURCE_EXHAUSTED|quota|404|NOT_FOUND/i.test(msg)) sawBusy = true;
        console.log(`AI model ${model} failed: ${msg.slice(0, 120)}`);
      }
    }
    // Out of quota on every model: retrying immediately can't help.
    if (!sawBusy) break;
    await new Promise((r) => setTimeout(r, 1000 * (sweep + 1)));
  }
  if (!sawBusy) throw new Error("The AI has hit its usage limit for now — it resets automatically, please try again a bit later.");
  throw new Error("The AI service is busy right now — please try again in a minute.");
}

// AI features are a Pro feature (super users and admins have everything).
async function requirePaidAi(ctx: { runQuery: (...a: any[]) => Promise<any> }) {
  const p = await ctx.runQuery(api.billing.myPlan, {});
  if (p.plan === "starter") throw new Error("AI features are part of Pro — upgrade in Settings → Plan & billing.");
}

// AI coaching critique of a single trade. Requires a GEMINI_API_KEY to be
// set on the Convex deployment (npx convex env set GEMINI_API_KEY <key>);
// get a free key at https://aistudio.google.com/apikey.
export const reviewTrade = action({
  args: { tradeId: v.id("trades") },
  handler: async (ctx, { tradeId }) => {
    await requirePaidAi(ctx);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "AI review isn't set up yet. Add a GEMINI_API_KEY to the Convex deployment to enable it."
      );
    }

    const trade = await ctx.runQuery(api.trades.getTradeForReview, { tradeId });
    if (!trade) throw new Error("Trade not found");

    const prompt = `You are a blunt, experienced trading coach reviewing one trade from a trader's journal. Give a short, specific, honest critique in under 150 words covering: (1) how the entry/exit held up against the stated plan, (2) risk management — was the stop/target sized sensibly given the R-multiple achieved, (3) one concrete, actionable thing to change next time. No generic platitudes, no restating the numbers back — reference them only to make a point. Plain prose, no markdown headers.

Trade:
- Instrument: ${trade.instrument} (${trade.direction})
- Entry: ${trade.entryPrice} on ${trade.entryDate} ${trade.entryTime}
- Exit: ${trade.exitPrice} on ${trade.exitDate} ${trade.exitTime}
- Stop Loss: ${trade.stopLoss} · Take Profit: ${trade.takeProfit}
- Outcome: ${trade.outcome} · Net P&L: ${trade.netPnL} · R-multiple: ${trade.rMultiple} · Planned R:R: ${trade.plannedRR}
- Strategy/Setup: ${trade.strategy} / ${trade.setupType} · Session: ${trade.session}
- Entry reason: ${trade.entryReason}
- Exit reason: ${trade.exitReason}
- Followed plan: ${trade.followedPlan} · Revenge trade: ${trade.revengeTrade} · FOMO trade: ${trade.fomoTrade}
- Mistakes already noted by trader: ${trade.mistakesMade || "none"}
- Lessons already noted by trader: ${trade.lessonsLearned || "none"}`;

    await primeModelOrder(ctx);
    const ai = new GoogleGenAI({ apiKey });
    const response = await genWithRetry(ai, {
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    return response.text ?? "The AI didn't return a response — try again.";
  },
});

// Reads a TradingView (or any) chart screenshot and extracts whatever trade
// parameters are visibly labeled on it — instrument, direction, entry/SL/TP
// price lines, and the timeframe selector. Powers the "AI Auto" trade-entry
// mode: the trader uploads a chart, confirms/edits the detected fields, and
// still fills in lot size, rating, and their own notes by hand.
export const analyzeTradeChart = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await requirePaidAi(ctx);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "AI auto-fill isn't set up yet. Add a GEMINI_API_KEY to the Convex deployment to enable it."
      );
    }

    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Screenshot not found");

    const imageRes = await fetch(url);
    if (!imageRes.ok) throw new Error("Couldn't load the uploaded screenshot");
    const mimeType = imageRes.headers.get("content-type") || "image/png";
    const buffer = await imageRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const prompt = `You are reading a trading chart screenshot (likely from TradingView). Extract only what is actually labeled or visible on the chart — price-line labels, axis values, the symbol/ticker in the title, and the timeframe selector. Return ONLY raw JSON (no markdown fences, no commentary) in exactly this shape:

{
  "instrument": string | null,
  "direction": "BUY" | "SELL" | null,
  "entryPrice": number | null,
  "stopLoss": number | null,
  "takeProfit": number | null,
  "timeframe": string | null,
  "entryTime": string | null,
  "confidence": "high" | "medium" | "low"
}

Rules: entryTime is the date+time of the entry marker / position start / crosshair label if one is clearly visible, copied EXACTLY as the chart displays it, formatted "YYYY-MM-DD HH:MM" (the app converts the chart's time zone — do NOT convert it yourself); null if not visible. direction BUY means price is expected to rise from entry (stop below entry, target above); SELL is the reverse. timeframe should be short like "1m", "5m", "15m", "1H", "4H", "1D". If you cannot clearly read a value from the image, use null for it rather than guessing. Set confidence to "low" if more than one field is null or the chart is ambiguous.`;

    await primeModelOrder(ctx);
    const ai = new GoogleGenAI({ apiKey });
    const response = await genWithRetry(ai, {
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }],
        },
      ],
    });

    const raw = (response.text ?? "").trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

    try {
      return JSON.parse(cleaned);
    } catch {
      throw new Error("Couldn't read that chart clearly — try a screenshot with visible price labels.");
    }
  },
});

// Reads a screenshot of the MT5 mobile app's History tab and returns every closed
// trade visible on it, so the trader can confirm and import them in one go.
export const extractTradesFromScreenshot = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await requirePaidAi(ctx);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("AI import isn't set up yet (missing GEMINI_API_KEY).");

    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Screenshot not found");
    const imageRes = await fetch(url);
    if (!imageRes.ok) throw new Error("Couldn't load the uploaded screenshot");
    const mimeType = imageRes.headers.get("content-type") || "image/png";
    const base64 = Buffer.from(await imageRes.arrayBuffer()).toString("base64");

    const prompt = `This is a screenshot showing CLOSED trade history — from the MetaTrader 5 mobile app OR from TradingView (account history / paper trading / strategy tester 'List of trades'). In TradingView, 'Long'/'Short' means buy/sell, and each trade's entry and exit prices/times may be on separate rows or lines — combine them into one trade. Extract every closed trade you can clearly read. Return ONLY a raw JSON array (no markdown), each item exactly:
{
  "symbol": string,
  "type": "buy" | "sell",
  "volume": number,
  "openPrice": number | null,
  "closePrice": number | null,
  "openTime": string | null,
  "closeTime": string | null,
  "profit": number,
  "commission": number | null,
  "swap": number | null,
  "sl": number | null,
  "tp": number | null,
  "source": "tradingview" | "mt5" | "other"
}
Rules: set "source" to "tradingview" when the screenshot is from TradingView (its trading panel / account history / strategy tester), "mt5" for MetaTrader, else "other". Copy times EXACTLY as displayed — do NOT convert time zones (the app converts them). Times as "YYYY-MM-DD HH:MM" (MT5 shows "2026.10.19 14:32:10" -> convert); if a date isn't visible use null. "type" is the position direction (buy/sell shown beside the symbol). profit is the number on the right (negative if loss). Skip balance/deposit rows and anything you cannot read; never invent values. If nothing readable, return [].`;

    await primeModelOrder(ctx);
    const ai = new GoogleGenAI({ apiKey });
    const response = await genWithRetry(ai, {
      model: "gemini-3.8-flash",
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
      config: { responseMimeType: "application/json" },
    });
    const raw = (response.text ?? "").trim();
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    let parsed: any[];
    try {
      parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
      if (!Array.isArray(parsed)) throw new Error("not array");
    } catch {
      throw new Error("Couldn't read that screenshot — use a clear, full-screen capture of the History tab.");
    }
    const num = (x: any): number | null => {
      if (x === null || x === undefined || x === "") return null;
      const n = typeof x === "number" ? x : parseFloat(String(x).replace(/[\s,]/g, "").replace(/[^0-9.+-]/g, ""));
      return Number.isFinite(n) ? n : null;
    };
    const str = (x: any): string | null => (typeof x === "string" && x.trim() ? x.trim() : null);
    return parsed
      .map((r) => ({
        symbol: (str(r?.symbol) ?? "").replace(/[^A-Za-z0-9._#]/g, ""),
        type: String(r?.type ?? "buy").toLowerCase().startsWith("s") ? "sell" : "buy",
        volume: num(r?.volume),
        openPrice: num(r?.openPrice),
        closePrice: num(r?.closePrice),
        openTime: str(r?.openTime),
        closeTime: str(r?.closeTime),
        profit: num(r?.profit),
        commission: num(r?.commission),
        swap: num(r?.swap),
        sl: num(r?.sl),
        tp: num(r?.tp),
        source: ['tradingview', 'mt5'].includes(String(r?.source ?? '').toLowerCase()) ? String(r.source).toLowerCase() : 'other',
      }))
      .filter((r) => r.symbol && r.volume !== null && r.volume > 0 && r.profit !== null);
  },
});

// Reads a screenshot of a prop-firm challenge (rules table / account dashboard /
// purchase page) and returns the firm, account size and each stage's rules in %.
export const extractChallengeFromScreenshot = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await requirePaidAi(ctx);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("AI import isn't set up yet (missing GEMINI_API_KEY).");

    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Screenshot not found");
    const imageRes = await fetch(url);
    if (!imageRes.ok) throw new Error("Couldn't load the uploaded screenshot");
    const mimeType = imageRes.headers.get("content-type") || "image/png";
    const base64 = Buffer.from(await imageRes.arrayBuffer()).toString("base64");

    const prompt = `This is a screenshot from a prop trading firm (e.g. The5ers, FTMO, Funding Pips) showing a challenge's rules and/or an account dashboard. Extract the challenge structure. Return ONLY raw JSON:
{
  "firm": string | null,
  "accountSize": number | null,
  "programType": "instant" | "1step" | "2step" | null,
  "drawdownType": "static" | "trailing" | null,
  "trailingLocksAtStart": boolean | null,
  "stages": [
    { "stage": "Phase 1" | "Phase 2" | "Funded / Payout",
      "targetPct": number,           // profit target in % of account size (use 0 for funded/payout with no target)
      "dailyLossPct": number | null, // max daily loss in %
      "maxLossPct": number | null    // max overall loss in %
    }
  ]
}
Rules: \"programType\" is \"instant\" for instant-funded accounts (no evaluation: the account is funded immediately — then return ONE stage named \"Funded / Payout\" with targetPct = any payout/profit target shown or 0, plus its daily/max loss), \"1step\" for Phase 1 then funded, \"2step\" for Phase 1, Phase 2, funded. \"drawdownType\" is \"trailing\" when the max drawdown/loss is described as trailing (it follows the highest balance/equity), \"static\" when it is fixed from the starting balance (static/fixed/balance-based); null if not stated. \"trailingLocksAtStart\" is true if the trailing drawdown stops trailing once it reaches the initial balance. Name stages exactly "Phase 1", "Phase 2" and "Funded / Payout" (map Challenge/Evaluation/Step 1 -> Phase 1; Verification/Step 2 -> Phase 2; Funded/Live/Master/FTMO Account/Payout -> Funded / Payout). If limits or targets are shown only in dollars, convert to % of accountSize. Use percentages exactly as shown. If the page shows a "1 Step" and "2 Steps" table, pick the column the screenshot emphasizes/was selected; if unclear, prefer the 2-step (Phase 1 + Phase 2 + Funded). A 1-step challenge has Phase 1 then Funded. accountSize is in dollars (e.g. 100000); null if not visible. Never invent numbers you can't see; omit unknown fields as null.`;

    await primeModelOrder(ctx);
    const ai = new GoogleGenAI({ apiKey });
    const response = await genWithRetry(ai, {
      model: "gemini-3.8-flash",
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
      config: { responseMimeType: "application/json" },
    });
    const raw = (response.text ?? "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    let parsed: any;
    try {
      parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
    } catch {
      throw new Error("Couldn't read that screenshot — try a clearer one showing the challenge rules.");
    }
    const num = (x: any): number | null => {
      if (x === null || x === undefined || x === "") return null;
      const n = typeof x === "number" ? x : parseFloat(String(x).replace(/[^0-9.+-]/g, ""));
      return Number.isFinite(n) ? n : null;
    };
    const stages = (Array.isArray(parsed?.stages) ? parsed.stages : [])
      .map((s: any, i: number) => ({
        stage: typeof s?.stage === "string" && s.stage.trim() ? s.stage.trim() : `Phase ${i + 1}`,
        targetPct: num(s?.targetPct) ?? 0,
        dailyLossPct: num(s?.dailyLossPct),
        maxLossPct: num(s?.maxLossPct),
      }))
      .slice(0, 4);
    const programType = ["instant", "1step", "2step"].includes(String(parsed?.programType)) ? String(parsed.programType) : null;
    const drawdownType = ["static", "trailing"].includes(String(parsed?.drawdownType)) ? String(parsed.drawdownType) : null;
    return {
      programType,
      drawdownType,
      trailingLocksAtStart: parsed?.trailingLocksAtStart === true,
      firm: typeof parsed?.firm === "string" ? parsed.firm.trim() : null,
      accountSize: num(parsed?.accountSize),
      stages,
    };
  },
});

const COACH_SYSTEM = `You are "Coach", the personal trading coach inside the TraderVault journal app. You are talking to ONE trader about ONE trading account (the current one) and its data only, provided below in the TRADER SNAPSHOT (accounts, prop-firm challenge phases, stats, discipline/psychology data and recent trades).

The trader's strategy ("9 EMA / VWAP Cross"): enter long when the 9 EMA crosses above VWAP, short when it crosses below; only in the New York session (09:30–16:00 America/New_York); one position at a time; stop loss at the low (long) / high (short) of the signal candle; take profit at 1:2 risk-reward; exit early if a candle opens on one side of the 9 EMA and closes on the other against the trade. Use these rules to judge their trades (e.g. trades outside NY hours, RR below 1:2, moving stops, or ignoring the EMA exit are rule breaks).

Time zones: the trader is in Pakistan (PKT, UTC+5) and every time in the journal and in this snapshot is Pakistan time. Their TradingView chart shows a different clock — TradingView times are earlier than Pakistan time by the offset given in the snapshot (default 7 hours: TradingView 14:00 = 21:00 PKT). When they quote a time from TradingView, convert it to PKT before judging sessions (Asian / London / New York) or whether a trade was inside the 09:30–16:00 New York window.

How to coach:
- Be warm but direct, like a seasoned mentor. Short paragraphs, plain language. Use their real numbers (phase balances, how much they can still lose today, win rate by session, etc.). Never invent data that isn't in the snapshot; if something is missing, say so and ask.
- Know their stage: when a prop-firm phase is active, always respect its rules (daily loss room, max loss buffer, target). If they're close to a breach, prioritise capital protection and say so clearly.
- Psychology: notice patterns in mood, revenge/FOMO trades, broken plans, streaks and over-trading. Name the pattern, explain why it hurts, and give 1–3 concrete actions (e.g. a max-trades rule, a daily stop, a pre-trade checklist).
- Give process, risk-management and review suggestions. Do NOT give specific buy/sell signals or price predictions, and do not promise profits. Remind them gently that you're a journaling coach, not a financial advisor, only when relevant.
- Keep replies concise (usually 80–200 words). Use short bullet lists with "-" when helpful and **bold** for key numbers. End with one useful follow-up question when it makes sense.`;

export const chatWithCoach = action({
  args: { accountId: v.id("accounts"), text: v.string() },
  handler: async (ctx, { accountId, text }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await requirePaidAi(ctx);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("The coach isn't set up yet (missing GEMINI_API_KEY).");
    const message = text.trim();
    if (!message) throw new Error("Type a message first.");

    await ctx.runMutation(api.coach.saveMessage, { accountId, role: "user", content: message });

    const snapshot: string = await ctx.runQuery(api.coach.getContext, { accountId });
    const history = await ctx.runQuery(api.coach.getMessages, { accountId });

    const contents = history.slice(-24).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    await primeModelOrder(ctx);
    const ai = new GoogleGenAI({ apiKey });
    const response = await genWithRetry(ai, {
      model: "gemini-3.8-flash",
      contents,
      config: { systemInstruction: `${COACH_SYSTEM}\n\nTRADER SNAPSHOT:\n${snapshot}` },
    });
    const reply = (response.text ?? "").trim() || "I couldn't come up with a reply — try rephrasing?";
    await ctx.runMutation(api.coach.saveMessage, { accountId, role: "assistant", content: reply });
    return reply;
  },
});
