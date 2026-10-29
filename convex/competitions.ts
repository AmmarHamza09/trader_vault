import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthedUser } from "./helpers";

function statusOf(startDate: string, endDate: string): "upcoming" | "active" | "ended" {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) return "upcoming";
  if (today > endDate) return "ended";
  return "active";
}

export const listCompetitions = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUser(ctx);
    const competitions = await ctx.db.query("competitions").collect();

    const results = [];
    for (const comp of competitions) {
      const participants = await ctx.db
        .query("competitionParticipants")
        .withIndex("by_competition", (q) => q.eq("competitionId", comp._id))
        .collect();

      const creator = await ctx.db.get(comp.createdBy);

      results.push({
        id: comp._id,
        title: comp.title,
        description: comp.description,
        startDate: comp.startDate,
        endDate: comp.endDate,
        createdBy: comp.createdBy,
        creatorName: creator?.name ?? "Unknown",
        participantCount: participants.length,
        isJoined: participants.some((p) => p.userId === user._id),
        status: statusOf(comp.startDate, comp.endDate),
        targetMetric: comp.targetMetric,
        targetValue: comp.targetValue,
      });
    }

    return results.sort((a, b) => a.startDate.localeCompare(b.startDate));
  },
});

export const getCompetition = query({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const user = await requireAuthedUser(ctx);
    const comp = await ctx.db.get(competitionId);
    if (!comp) throw new Error("Competition not found");

    const participants = await ctx.db
      .query("competitionParticipants")
      .withIndex("by_competition", (q) => q.eq("competitionId", competitionId))
      .collect();

    const creator = await ctx.db.get(comp.createdBy);

    return {
      id: comp._id,
      title: comp.title,
      description: comp.description,
      startDate: comp.startDate,
      endDate: comp.endDate,
      createdBy: comp.createdBy,
      creatorName: creator?.name ?? "Unknown",
      participantCount: participants.length,
      isJoined: participants.some((p) => p.userId === user._id),
      status: statusOf(comp.startDate, comp.endDate),
      targetMetric: comp.targetMetric,
      targetValue: comp.targetValue,
    };
  },
});

export const createCompetition = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    targetMetric: v.optional(v.union(v.literal("netPnL"), v.literal("returnPercentage"))),
    targetValue: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);

    if (args.endDate < args.startDate) {
      throw new Error("End date must be on or after the start date");
    }

    const competitionId = await ctx.db.insert("competitions", {
      title: args.title,
      description: args.description,
      createdBy: user._id,
      startDate: args.startDate,
      endDate: args.endDate,
      targetMetric: args.targetValue !== undefined ? args.targetMetric ?? "netPnL" : undefined,
      targetValue: args.targetValue,
    });

    await ctx.db.insert("competitionParticipants", {
      competitionId,
      userId: user._id,
      joinedAt: Date.now(),
    });

    return competitionId;
  },
});

export const joinCompetition = mutation({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const user = await requireAuthedUser(ctx);
    const comp = await ctx.db.get(competitionId);
    if (!comp) throw new Error("Competition not found");

    const existing = await ctx.db
      .query("competitionParticipants")
      .withIndex("by_competition_user", (q) =>
        q.eq("competitionId", competitionId).eq("userId", user._id)
      )
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("competitionParticipants", {
      competitionId,
      userId: user._id,
      joinedAt: Date.now(),
    });
  },
});

export const leaveCompetition = mutation({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const user = await requireAuthedUser(ctx);
    const existing = await ctx.db
      .query("competitionParticipants")
      .withIndex("by_competition_user", (q) =>
        q.eq("competitionId", competitionId).eq("userId", user._id)
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const getCompetitionLeaderboard = query({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    await requireAuthedUser(ctx);
    const comp = await ctx.db.get(competitionId);
    if (!comp) throw new Error("Competition not found");

    const participants = await ctx.db
      .query("competitionParticipants")
      .withIndex("by_competition", (q) => q.eq("competitionId", competitionId))
      .collect();

    const entries = [];
    for (const participant of participants) {
      const user = await ctx.db.get(participant.userId);
      if (!user) continue;

      const trades = await ctx.db
        .query("trades")
        .withIndex("by_user_date", (q) =>
          q
            .eq("userId", user._id)
            .gte("entryDate", comp.startDate)
            .lte("entryDate", comp.endDate)
        )
        .collect();

      const accounts = await ctx.db
        .query("accounts")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const startingTotal = accounts.reduce((s, a) => s + a.startingBalance, 0);
      const base = startingTotal > 0 ? startingTotal : user.defaultAccountBalance;

      let netPnL = 0;
      let wins = 0;
      for (const t of trades) {
        netPnL += t.netPnL;
        if (t.outcome === "WIN") wins++;
      }

      entries.push({
        userId: user._id,
        name: user.name,
        avatar: user.avatar ?? "",
        netPnL: Math.round(netPnL * 100) / 100,
        returnPercentage: base > 0 ? Math.round((netPnL / base) * 10000) / 100 : 0,
        winRate: trades.length > 0 ? Math.round((wins / trades.length) * 1000) / 10 : 0,
        totalTrades: trades.length,
      });
    }

    entries.sort((a, b) => b.returnPercentage - a.returnPercentage);
    const ranked = entries.map((entry, index) => ({ ...entry, rank: index + 1 }));

    let winnerUserId: string | null = null;
    if (comp.targetMetric && comp.targetValue !== undefined) {
      const qualifiers = ranked.filter((e) => e[comp.targetMetric!] >= comp.targetValue!);
      // Among those who reached the goal, the one with the strongest performance wins.
      winnerUserId = qualifiers[0]?.userId ?? null;
    }

    return {
      entries: ranked,
      targetMetric: comp.targetMetric ?? null,
      targetValue: comp.targetValue ?? null,
      winnerUserId,
    };
  },
});
