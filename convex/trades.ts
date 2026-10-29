import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { recalcAccountBalance, requireAuthedUser } from "./helpers";

const screenshotValidator = v.object({
  id: v.string(),
  type: v.string(), // 'entry' | 'exit' | 'analysis'
  storageId: v.id("_storage"),
  caption: v.optional(v.string()),
});

// Every field of a trade except userId (which is set server-side on create).
const tradeFields = {
  accountId: v.id("accounts"),
  instrument: v.string(),
  direction: v.string(),
  entryDate: v.string(),
  entryTime: v.string(),
  exitDate: v.string(),
  exitTime: v.string(),
  entryPrice: v.number(),
  exitPrice: v.number(),
  stopLoss: v.number(),
  takeProfit: v.number(),
  positionSize: v.number(),
  riskAmount: v.number(),
  potentialReward: v.number(),
  grossPnL: v.number(),
  commission: v.number(),
  swap: v.number(),
  netPnL: v.number(),
  outcome: v.string(),
  rMultiple: v.number(),
  plannedRR: v.number(),
  roiPercentage: v.number(),
  strategy: v.string(),
  timeframe: v.string(),
  session: v.string(),
  setupType: v.string(),
  marketConditions: v.optional(v.string()),
  entryReason: v.string(),
  exitReason: v.string(),
  mistakesMade: v.optional(v.string()),
  lessonsLearned: v.optional(v.string()),
  tags: v.array(v.string()),
  moodBefore: v.string(),
  confidenceLevel: v.number(),
  emotionDuring: v.string(),
  followedPlan: v.boolean(),
  revengeTrade: v.boolean(),
  fomoTrade: v.boolean(),
  mt5Ticket: v.optional(v.string()),
  screenshots: v.array(screenshotValidator),
};

// Step 1 of a screenshot upload: the browser POSTs the file to this URL.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuthedUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getUserTrades = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUser(ctx);

    const trades = await ctx.db
      .query("trades")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return await Promise.all(
      trades.map(async (trade) => ({
        ...trade,
        screenshots: await Promise.all(
          trade.screenshots.map(async (shot) => ({
            ...shot,
            url: await ctx.storage.getUrl(shot.storageId),
          }))
        ),
      }))
    );
  },
});

// Fetches a single trade for the AI review action — ownership-checked like
// every other trade read, just callable from an action via ctx.runQuery.
export const getTradeForReview = query({
  args: { tradeId: v.id("trades") },
  handler: async (ctx, { tradeId }) => {
    const user = await requireAuthedUser(ctx);
    const trade = await ctx.db.get(tradeId);
    if (!trade || trade.userId !== user._id) return null;
    return trade;
  },
});

export const createTrade = mutation({
  args: tradeFields,
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);

    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== user._id) {
      throw new Error("Trading account not found");
    }

    const tradeId = await ctx.db.insert("trades", { userId: user._id, ...args });
    await recalcAccountBalance(ctx, args.accountId);
    return tradeId;
  },
});

// Bulk-insert trades from a CSV import. Recalculates each distinct
// account's balance once at the end rather than after every insert.
export const bulkCreateTrades = mutation({
  args: { trades: v.array(v.object(tradeFields)) },
  handler: async (ctx, { trades }) => {
    const user = await requireAuthedUser(ctx);

    const accountIds = new Set<string>();
    let imported = 0;

    for (const trade of trades) {
      const account = await ctx.db.get(trade.accountId);
      if (!account || account.userId !== user._id) continue;
      if (trade.mt5Ticket) {
        const dup = await ctx.db
          .query("trades")
          .withIndex("by_user_ticket", (q) => q.eq("userId", user._id).eq("mt5Ticket", trade.mt5Ticket))
          .first();
        if (dup) continue;
      }
      await ctx.db.insert("trades", { userId: user._id, ...trade });
      accountIds.add(trade.accountId);
      imported++;
    }

    for (const accountId of accountIds) {
      await recalcAccountBalance(ctx, accountId as any);
    }

    return { imported, skipped: trades.length - imported };
  },
});

export const updateTrade = mutation({
  args: { tradeId: v.id("trades"), ...tradeFields },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    const { tradeId, ...fields } = args;

    const existing = await ctx.db.get(tradeId);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Trade not found");
    }

    const account = await ctx.db.get(fields.accountId);
    if (!account || account.userId !== user._id) {
      throw new Error("Trading account not found");
    }

    // Remove files for screenshots that were taken off the trade
    const keptIds = new Set(fields.screenshots.map((s) => s.storageId));
    for (const old of existing.screenshots) {
      if (!keptIds.has(old.storageId)) {
        await ctx.storage.delete(old.storageId);
      }
    }

    await ctx.db.replace(tradeId, { userId: user._id, ...fields, mt5Ticket: existing.mt5Ticket });

    await recalcAccountBalance(ctx, fields.accountId);
    if (existing.accountId !== fields.accountId) {
      await recalcAccountBalance(ctx, existing.accountId);
    }
    return tradeId;
  },
});

export const deleteTrade = mutation({
  args: { tradeId: v.id("trades") },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    const trade = await ctx.db.get(args.tradeId);
    if (!trade || trade.userId !== user._id) return;

    for (const shot of trade.screenshots) {
      await ctx.storage.delete(shot.storageId);
    }
    await ctx.db.delete(args.tradeId);
    await recalcAccountBalance(ctx, trade.accountId);
  },
});
