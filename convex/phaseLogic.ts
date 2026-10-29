import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";

export const r2 = (n: number) => Math.round(n * 100) / 100;
export const todayPKT = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);

// Live progress + rule status for one phase. Passed/failed phases are LOCKED:
// they keep their stored status and the balance they were locked at.
export function evaluate(phase: Doc<"phases">, trades: Doc<"trades">[], accounts: Doc<"accounts">[]) {
  const locked = phase.status === "passed" || phase.status === "failed";
  const upcoming = phase.status === "upcoming";

  const scopedAccounts = phase.accountId ? accounts.filter((a) => a._id === phase.accountId) : accounts;
  const liveEquity = scopedAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

  const currentBalance = r2(
    upcoming ? phase.startBalance : locked && phase.lockedBalance != null ? phase.lockedBalance : liveEquity > 0 ? liveEquity : phase.startBalance
  );
  const totalPnL = r2(currentBalance - phase.startBalance);

  const scoped = upcoming
    ? []
    : trades
        .filter((t) => t.entryDate >= phase.startDate)
        .filter((t) => phase.startedAt == null || t._creationTime >= phase.startedAt)
        .filter((t) => !phase.accountId || t.accountId === phase.accountId);
  const byDay = new Map<string, number>();
  for (const t of scoped) byDay.set(t.entryDate, (byDay.get(t.entryDate) ?? 0) + t.netPnL);
  const worstDay = [...byDay.values()].reduce((min, d) => Math.min(min, d), 0);
  const todayPnL = r2(byDay.get(todayPKT()) ?? 0);

  const gainNeeded = phase.targetBalance - phase.startBalance;
  const progressPct =
    gainNeeded !== 0 ? Math.max(0, Math.min(100, Math.round((totalPnL / gainNeeded) * 100))) : 0;

  // ---- highest balance seen (drives a trailing drawdown floor)
  const trailing = phase.drawdownType === "trailing";
  let peak = phase.peakBalance ?? phase.startBalance;
  if (!locked && !upcoming) {
    const scopedPnL = scoped.reduce((s, t) => s + t.netPnL, 0);
    let run = currentBalance - scopedPnL; // balance when tracking began
    let seriesPeak = run;
    const ordered = [...scoped].sort((a, b) => (a.exitDate + a.exitTime < b.exitDate + b.exitTime ? -1 : 1));
    for (const t of ordered) {
      run += t.netPnL;
      if (run > seriesPeak) seriesPeak = run;
    }
    peak = Math.max(peak, currentBalance, seriesPeak, phase.startBalance);
  }
  peak = r2(peak);

  // static: floor = start − max loss.  trailing: floor = highest balance − max loss
  // (optionally capped at the start balance once it gets there — "locks at breakeven").
  const maxTotalLoss = phase.maxTotalLoss != null ? Math.abs(phase.maxTotalLoss) : null;
  let totalLossFloor: number | null = null;
  if (maxTotalLoss != null) {
    const raw = trailing ? peak - maxTotalLoss : phase.startBalance - maxTotalLoss;
    totalLossFloor = r2(trailing && phase.trailingLock ? Math.min(raw, phase.startBalance) : raw);
  }

  let status = phase.status;
  let failReason: string | null = phase.failReason ?? null;
  if (status === "active") {
    if (maxTotalLoss != null && totalLossFloor != null && currentBalance <= totalLossFloor) {
      status = "failed";
      failReason = trailing
        ? `Trailing drawdown breached (floor $${totalLossFloor.toLocaleString()}, peak $${peak.toLocaleString()})`
        : `Max loss of $${maxTotalLoss.toLocaleString()} breached`;
    } else if (phase.maxDailyLoss != null && worstDay <= -Math.abs(phase.maxDailyLoss)) {
      status = "failed";
      failReason = `Daily loss limit of $${Math.abs(phase.maxDailyLoss).toLocaleString()} breached`;
    } else if (phase.targetBalance > phase.startBalance && currentBalance >= phase.targetBalance) {
      status = "passed";
    }
  }

  const dailyProfitHit = phase.dailyProfitTarget != null && todayPnL >= Math.abs(phase.dailyProfitTarget);

  const totalLossRoom = maxTotalLoss != null ? r2(Math.max(0, currentBalance - (totalLossFloor as number))) : null;
  const totalLossPct =
    maxTotalLoss != null ? Math.max(0, Math.min(100, Math.round(((totalLossRoom as number) / maxTotalLoss) * 100))) : null;

  const maxDailyLoss = phase.maxDailyLoss != null ? Math.abs(phase.maxDailyLoss) : null;
  const dailyLossRoom = maxDailyLoss != null ? r2(Math.max(0, maxDailyLoss + todayPnL)) : null;
  const dailyLossFloor = maxDailyLoss != null ? r2(currentBalance - (dailyLossRoom as number)) : null;
  const dailyLossPct =
    maxDailyLoss != null ? Math.max(0, Math.min(100, Math.round(((dailyLossRoom as number) / maxDailyLoss) * 100))) : null;

  return {
    totalPnL, currentBalance, progressPct, worstDay, todayPnL, dailyProfitHit,
    tradeCount: scoped.length, status, failReason, locked, peak, trailing,
    profitTargetAmount: r2(gainNeeded),
    profitRemaining: r2(Math.max(0, phase.targetBalance - currentBalance)),
    totalLossFloor, totalLossRoom, totalLossPct,
    dailyLossFloor, dailyLossRoom, dailyLossPct,
  };
}

// Activates an upcoming phase. If it tracks an account whose live balance differs
// from the phase's start balance (e.g. Phase 2 on the same account after Phase 1),
// re-base the phase on the current balance and scale its target/limits to match.
export async function activatePhaseDoc(ctx: MutationCtx, phase: Doc<"phases">, accounts: Doc<"accounts">[]) {
  const acc = phase.accountId ? accounts.find((a) => a._id === phase.accountId) : undefined;
  const equity = acc?.currentBalance;
  const patch: Partial<Doc<"phases">> = { status: "active", startDate: todayPKT(), startedAt: Date.now(), peakBalance: equity && equity > 0 ? equity : phase.startBalance };
  if (equity && equity > 0 && Math.abs(equity - phase.startBalance) > 0.01) {
    const f = equity / phase.startBalance;
    patch.startBalance = r2(equity);
    patch.targetBalance = r2(phase.targetBalance * f);
    if (phase.maxDailyLoss != null) patch.maxDailyLoss = r2(phase.maxDailyLoss * f);
    if (phase.maxTotalLoss != null) patch.maxTotalLoss = r2(phase.maxTotalLoss * f);
    if (phase.dailyProfitTarget != null) patch.dailyProfitTarget = r2(phase.dailyProfitTarget * f);
  }
  await ctx.db.patch(phase._id, patch);
}

// Re-checks every active phase for this user: locks passed/failed ones and
// unlocks the next stage in the chain when a phase is passed.
export async function refreshPhases(ctx: MutationCtx, userId: Id<"users">) {
  const phases = await ctx.db.query("phases").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  if (!phases.some((p) => p.status === "active")) return;
  const trades = await ctx.db.query("trades").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  const accounts = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).collect();

  for (const phase of phases.filter((p) => p.status === "active")) {
    const ev = evaluate(phase, trades, accounts);
    if (ev.status === "active") {
      if (ev.peak !== phase.peakBalance) await ctx.db.patch(phase._id, { peakBalance: ev.peak });
      continue;
    }
    await ctx.db.patch(phase._id, {
      peakBalance: ev.peak,
      status: ev.status,
      lockedBalance: ev.currentBalance,
      lockedAt: Date.now(),
      failReason: ev.failReason ?? undefined,
    });
    if (ev.status === "passed") {
      const next = phases.find((p) => p.prevPhaseId === phase._id && p.status === "upcoming");
      if (next) await activatePhaseDoc(ctx, next, accounts);
    }
  }
}
