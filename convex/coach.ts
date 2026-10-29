import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthedUser } from "./helpers";
import { evaluate } from "./phaseLogic";

const r2 = (n: number) => Math.round(n * 100) / 100;

const ownAccount = async (ctx: any, userId: any, accountId: any) => {
  const acc = await ctx.db.get(accountId);
  if (!acc || acc.userId !== userId) throw new Error("Account not found");
  return acc;
};

export const getMessages = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }) => {
    const user = await requireAuthedUser(ctx);
    await ownAccount(ctx, user._id, accountId);
    const msgs = await ctx.db.query("coachMessages").withIndex("by_user_account", (q) => q.eq("userId", user._id).eq("accountId", accountId)).order("desc").take(60);
    return msgs.reverse().map((m) => ({ _id: m._id, role: m.role, content: m.content, _creationTime: m._creationTime }));
  },
});

export const saveMessage = mutation({
  args: { accountId: v.id("accounts"), role: v.string(), content: v.string() },
  handler: async (ctx, { accountId, role, content }) => {
    const user = await requireAuthedUser(ctx);
    await ownAccount(ctx, user._id, accountId);
    await ctx.db.insert("coachMessages", { userId: user._id, accountId, role, content: content.slice(0, 8000) });
  },
});

export const clearChat = mutation({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }) => {
    const user = await requireAuthedUser(ctx);
    await ownAccount(ctx, user._id, accountId);
    const msgs = await ctx.db.query("coachMessages").withIndex("by_user_account", (q) => q.eq("userId", user._id).eq("accountId", accountId)).collect();
    for (const m of msgs) await ctx.db.delete(m._id);
  },
});

// Plain-text snapshot of the trader's situation, fed to the coach on every message.
export const getContext = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }) => {
    const user = await requireAuthedUser(ctx);
    const account = await ownAccount(ctx, user._id, accountId);
    const accounts = [account];
    const trades = (await ctx.db.query("trades").withIndex("by_user", (q) => q.eq("userId", user._id)).collect()).filter((t) => t.accountId === accountId);
    const phases = (await ctx.db.query("phases").withIndex("by_user", (q) => q.eq("userId", user._id)).collect()).filter((p) => p.accountId === accountId);
    const goals = await ctx.db.query("goals").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();

    const accName = (id: string) => accounts.find((a) => a._id === id)?.name ?? "?";
    const sorted = [...trades].sort((a, b) => (a.entryDate + a.entryTime < b.entryDate + b.entryTime ? 1 : -1));
    const wins = trades.filter((t) => t.netPnL > 0);
    const losses = trades.filter((t) => t.netPnL < 0);
    const grossWin = wins.reduce((s, t) => s + t.netPnL, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnL, 0));
    const net = r2(trades.reduce((s, t) => s + t.netPnL, 0));
    const avgR = trades.length ? r2(trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length) : 0;

    const group = (key: (t: (typeof trades)[number]) => string) => {
      const m = new Map<string, { n: number; pnl: number; w: number }>();
      for (const t of trades) {
        const k = key(t) || "?";
        const e = m.get(k) ?? { n: 0, pnl: 0, w: 0 };
        e.n++; e.pnl += t.netPnL; if (t.netPnL > 0) e.w++;
        m.set(k, e);
      }
      return [...m.entries()].map(([k, e]) => `${k}: ${e.n} trades, ${r2(e.pnl)} P&L, ${Math.round((e.w / e.n) * 100)}% win`).join(" | ");
    };

    // current losing/winning streak (most recent first)
    let streak = 0; let streakType = "";
    for (const t of sorted) {
      const type = t.netPnL > 0 ? "win" : t.netPnL < 0 ? "loss" : "be";
      if (!streakType) { streakType = type; streak = 1; } else if (type === streakType) streak++; else break;
    }

    const lines: string[] = [];
    lines.push(`Trader: ${user.name}. Date (Pakistan time): ${new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ")}.`);
    lines.push(`Clock: all times here are Pakistan time (PKT). TradingView chart time is ${user.tvTimeOffsetHours ?? 7} hours earlier than PKT (TradingView 14:00 = ${String((14 + (user.tvTimeOffsetHours ?? 7)) % 24).padStart(2, "0")}:00 PKT); MT5 screenshot time needs ${user.mt5TimeOffsetHours ?? 0}h added.`);
    lines.push(`Current account (the ONLY account being discussed; ignore any others): ${accounts.map((a) => `${a.name} (${a.type}, balance ${a.currentBalance}, started ${a.startingBalance})`).join("; ") || "none"}.`);

    lines.push("PROP-FIRM / CHALLENGE PHASES:");
    if (phases.length === 0) lines.push("  none set up.");
    for (const p of phases.filter((x) => !x.archived).sort((a, b) => (a.stageOrder ?? 0) - (b.stageOrder ?? 0))) {
      const e = evaluate(p, trades, accounts);
      lines.push(
        `  ${p.firm ?? ""} ${p.stage ?? p.name} on ${p.accountId ? accName(p.accountId) : "all accounts"}: status ${e.status}${e.failReason ? " (" + e.failReason + ")" : ""}; balance ${e.currentBalance}, target ${p.targetBalance} (${e.profitRemaining} to go); ` +
        `${p.maxDailyLoss != null ? `can still lose ${e.dailyLossRoom} today of ${p.maxDailyLoss} daily limit; ` : ""}` +
        `${p.maxTotalLoss != null ? `${e.totalLossRoom} left before max-loss breach (limit ${p.maxTotalLoss}); ` : ""}` +
        `${p.dailyProfitTarget != null ? `daily goal ${p.dailyProfitTarget}, today ${e.todayPnL}` : ""}`
      );
    }

    lines.push(`OVERALL (${trades.length} trades): net ${net}, win rate ${trades.length ? Math.round((wins.length / trades.length) * 100) : 0}%, profit factor ${grossLoss ? r2(grossWin / grossLoss) : "n/a"}, avg R ${avgR}, current streak ${streak} ${streakType}.`);
    if (trades.length) {
      lines.push(`By session: ${group((t) => t.session)}`);
      lines.push(`By instrument: ${group((t) => t.instrument)}`);
      lines.push(`By direction: ${group((t) => t.direction)}`);
      lines.push(`By mood before trade: ${group((t) => t.moodBefore)}`);
      lines.push(`By emotion during: ${group((t) => t.emotionDuring)}`);
    }
    const nPlan = trades.filter((t) => !t.followedPlan).length;
    lines.push(`DISCIPLINE: broke plan on ${nPlan}/${trades.length} trades; revenge trades ${trades.filter((t) => t.revengeTrade).length}; FOMO trades ${trades.filter((t) => t.fomoTrade).length}; avg confidence ${trades.length ? r2(trades.reduce((s, t) => s + t.confidenceLevel, 0) / trades.length) : 0}/5.`);
    const mistakes = sorted.map((t) => t.mistakesMade).filter((m) => m && m.trim()).slice(0, 8);
    if (mistakes.length) lines.push(`Recent self-noted mistakes: ${mistakes.join(" || ")}`);
    const lessons = sorted.map((t) => t.lessonsLearned).filter((m) => m && m.trim()).slice(0, 5);
    if (lessons.length) lines.push(`Recent lessons: ${lessons.join(" || ")}`);

    lines.push("LAST 25 TRADES (newest first):");
    for (const t of sorted.slice(0, 25)) {
      lines.push(`  ${t.entryDate} ${t.entryTime} ${t.instrument} ${t.direction} ${t.positionSize}lots ${t.session} ${accName(t.accountId)}: net ${t.netPnL} (${t.rMultiple}R) ${t.outcome}, mood ${t.moodBefore}/${t.emotionDuring}, ${t.followedPlan ? "followed plan" : "BROKE plan"}${t.revengeTrade ? ", REVENGE" : ""}${t.fomoTrade ? ", FOMO" : ""}`);
    }
    const open = goals.filter((g) => !g.completed);
    if (open.length) lines.push(`GOALS: ${open.map((g) => `${g.title} ${g.currentValue}/${g.targetValue}${g.unit}`).join("; ")}`);
    return lines.join("\n");
  },
});
