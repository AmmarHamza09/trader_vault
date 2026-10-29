import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthedUser, recalcAccountBalance, requirePlan, planOf } from "./helpers";
import { internal } from "./_generated/api";

function randomKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "tv_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const getMt5Key = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUser(ctx);
    return user.mt5ApiKey ?? null;
  },
});

// Creates (or rotates) the secret key the MT5 Expert Advisor uses to post trades.
export const generateMt5Key = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUser(ctx);
    requirePlan(user, "pro", "MT5 / TradingView sync");
    const key = randomKey();
    await ctx.db.patch(user._id, { mt5ApiKey: key });
    return key;
  },
});

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
function pkt(secs: number): { date: string; time: string; hour: number } {
  const d = new Date(secs * 1000 + PKT_OFFSET_MS);
  const iso = d.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), hour: d.getUTCHours() };
}

function sessionFor(utcHour: number): string {
  if (utcHour >= 12 && utcHour < 16) return "Overlap";
  if (utcHour >= 7 && utcHour < 12) return "London";
  if (utcHour >= 16 && utcHour < 21) return "New York";
  return "Asian";
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// Called by the HTTP webhook for every closed MT5 position. Idempotent per ticket.
export const ingestDeal = internalMutation({
  args: {
    apiKey: v.string(),
    ticket: v.string(),
    symbol: v.string(),
    type: v.string(),
    volume: v.number(),
    openPrice: v.number(),
    closePrice: v.number(),
    openTime: v.number(),
    closeTime: v.number(),
    sl: v.optional(v.number()),
    tp: v.optional(v.number()),
    profit: v.number(),
    commission: v.optional(v.number()),
    swap: v.optional(v.number()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const tvSource = a.source === "tradingview";
    const user = await ctx.db
      .query("users")
      .withIndex("by_mt5_key", (q) => q.eq("mt5ApiKey", a.apiKey))
      .first();
    if (!user || user.isBlocked) return { ok: false, reason: "invalid key" };
    if (planOf(user).plan === "starter") return { ok: false, reason: "plan required" };

    const dup = await ctx.db
      .query("trades")
      .withIndex("by_user_ticket", (q) => q.eq("userId", user._id).eq("mt5Ticket", a.ticket))
      .first();
    if (dup) return { ok: true, duplicate: true };

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const account =
      accounts.find((x) => x._id === user.defaultAccountId) ??
      accounts.find((x) => x.isDefault) ??
      accounts[0];
    if (!account) return { ok: false, reason: "no account" };

    const direction = a.type.toLowerCase().startsWith("s") ? "SELL" : "BUY";
    const commission = a.commission ?? 0;
    const swap = a.swap ?? 0;
    const grossPnL = r2(a.profit);
    const netPnL = r2(a.profit + commission + swap);

    // Value of one price unit for this trade, derived from the realized result.
    const move = Math.abs(a.closePrice - a.openPrice);
    const perUnit = move > 0 ? Math.abs(a.profit) / move : 0;
    const sl = a.sl ?? 0;
    const tp = a.tp ?? 0;
    const riskAmount = sl > 0 && perUnit > 0 ? r2(Math.abs(a.openPrice - sl) * perUnit) : 0;
    const potentialReward = tp > 0 && perUnit > 0 ? r2(Math.abs(tp - a.openPrice) * perUnit) : 0;
    const rMultiple = riskAmount > 0 ? r2(netPnL / riskAmount) : 0;
    const plannedRR = riskAmount > 0 ? r2(potentialReward / riskAmount) : 0;
    const outcome = netPnL > 10 ? "WIN" : netPnL < -10 ? "LOSS" : "BREAKEVEN";

    const open = pkt(a.openTime);
    const close = pkt(a.closeTime);

    await ctx.db.insert("trades", {
      userId: user._id,
      accountId: account._id,
      instrument: a.symbol.toUpperCase(),
      direction,
      entryDate: open.date,
      entryTime: open.time,
      exitDate: close.date,
      exitTime: close.time,
      entryPrice: a.openPrice,
      exitPrice: a.closePrice,
      stopLoss: sl,
      takeProfit: tp,
      positionSize: a.volume,
      riskAmount,
      potentialReward,
      grossPnL,
      commission,
      swap,
      netPnL,
      outcome,
      rMultiple,
      plannedRR,
      roiPercentage: account.startingBalance > 0 ? r2((netPnL / account.startingBalance) * 100) : 0,
      strategy: tvSource ? "9 EMA / VWAP Cross (1:2)" : "MT5 Auto-Sync",
      timeframe: "Unknown",
      session: tvSource ? "New York" : sessionFor((open.hour + 19) % 24),
      setupType: tvSource ? "EMA/VWAP Cross" : "MT5 Auto-Sync",
      entryReason: tvSource ? "Synced from TradingView alert" : "Synced from MT5",
      exitReason: tvSource ? "Synced from TradingView alert" : "Synced from MT5",
      tags: [tvSource ? "tradingview" : "mt5"],
      moodBefore: "Neutral",
      confidenceLevel: 3,
      emotionDuring: "Disciplined",
      followedPlan: true,
      revengeTrade: false,
      fomoTrade: false,
      screenshots: [],
      mt5Ticket: a.ticket,
    });
    await recalcAccountBalance(ctx, account._id);
    if (!tvSource) {
      await ctx.scheduler.runAfter(0, internal.pushSend.sendToUser, {
        userId: user._id,
        title: `${netPnL >= 0 ? "✅ Profit" : "❌ Loss"} ${netPnL >= 0 ? "+" : "-"}$${Math.abs(netPnL)} · ${a.symbol.toUpperCase()}`,
        body: "MT5 trade synced to your journal",
        tag: `mt5-${a.ticket}`,
      });
    }
    return { ok: true };
  },
});
