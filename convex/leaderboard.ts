import { query } from "./_generated/server";

export const getLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(200);

    const entries: Array<{
      userId: string;
      name: string;
      avatar: string;
      accountType: string;
      returnPercentage: number;
      netPnL: number;
      winRate: number;
      totalTrades: number;
      profitFactor: number;
      bestStreak: number;
      rankChange: number;
      favoriteInstrument: string;
      consistencyScore: number;
    }> = [];

    for (const user of users) {
      if (!user.leaderboardVisible) continue;

      const trades = await ctx.db
        .query("trades")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      if (trades.length === 0) continue;

      const accounts = await ctx.db
        .query("accounts")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      const startingTotal = accounts.reduce((s, a) => s + a.startingBalance, 0);
      const base = startingTotal > 0 ? startingTotal : user.defaultAccountBalance;

      let netPnL = 0;
      let grossProfit = 0;
      let grossLoss = 0;
      let wins = 0;
      const instrumentCounts: Record<string, number> = {};
      const daySums: Record<string, number> = {};

      const sorted = [...trades].sort((a, b) =>
        `${a.entryDate}T${a.entryTime}`.localeCompare(`${b.entryDate}T${b.entryTime}`)
      );

      let bestStreak = 0;
      let running = 0;

      for (const t of sorted) {
        netPnL += t.netPnL;
        instrumentCounts[t.instrument] = (instrumentCounts[t.instrument] || 0) + 1;
        daySums[t.entryDate] = (daySums[t.entryDate] || 0) + t.netPnL;

        if (t.outcome === "WIN") {
          wins++;
          grossProfit += t.netPnL;
          running++;
          if (running > bestStreak) bestStreak = running;
        } else if (t.outcome === "LOSS") {
          grossLoss += Math.abs(t.netPnL);
          running = 0;
        }
      }

      const favoriteInstrument =
        Object.entries(instrumentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

      const days = Object.values(daySums);
      const winningDays = days.filter((d) => d > 0).length;
      const consistencyScore =
        days.length > 0 ? Math.round((winningDays / days.length) * 100) : 0;

      const profitFactor =
        grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.99 : 0;

      const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0];

      entries.push({
        userId: user._id,
        name: user.name,
        avatar: user.avatar ?? "",
        accountType: defaultAccount?.type ?? "live",
        returnPercentage: base > 0 ? Math.round((netPnL / base) * 10000) / 100 : 0,
        netPnL: Math.round(netPnL * 100) / 100,
        winRate: Math.round((wins / trades.length) * 1000) / 10,
        totalTrades: trades.length,
        profitFactor: Math.round(profitFactor * 100) / 100,
        bestStreak,
        rankChange: 0,
        favoriteInstrument,
        consistencyScore,
      });
    }

    entries.sort((a, b) => b.returnPercentage - a.returnPercentage);
    return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
  },
});