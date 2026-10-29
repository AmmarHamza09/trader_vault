import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { recalcAccountBalance, requireAuthedUser, planOf } from "./helpers";

export const getUserAccounts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUser(ctx);
    return await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const createAccount = mutation({
  args: {
    name: v.string(),
    broker: v.string(),
    type: v.string(), // 'live' | 'prop_firm' | 'demo'
    currency: v.string(),
    startingBalance: v.number(),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);

    const name = args.name.trim();
    if (!name) throw new Error("Account name is required");
    if (!Number.isFinite(args.startingBalance) || args.startingBalance < 0) {
      throw new Error("Starting balance must be a number that is 0 or more");
    }

    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (existing.length >= 1 && planOf(user).plan === "starter") {
      throw new Error("The free plan includes 1 trading account — upgrade to Pro in Settings → Plan & billing for unlimited accounts.");
    }

    const makeDefault = args.isDefault === true || existing.length === 0;

    if (makeDefault) {
      for (const acc of existing) {
        if (acc.isDefault) await ctx.db.patch(acc._id, { isDefault: false });
      }
    }

    const accountId = await ctx.db.insert("accounts", {
      userId: user._id,
      name,
      broker: args.broker.trim() || "Broker",
      type: args.type,
      currency: args.currency,
      startingBalance: args.startingBalance,
      currentBalance: args.startingBalance,
      isDefault: makeDefault,
    });

    if (makeDefault) {
      await ctx.db.patch(user._id, { defaultAccountId: accountId });
    }

    return accountId;
  },
});

export const updateAccount = mutation({
  args: {
    accountId: v.id("accounts"),
    name: v.optional(v.string()),
    broker: v.optional(v.string()),
    type: v.optional(v.string()),
    currency: v.optional(v.string()),
    startingBalance: v.optional(v.number()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== user._id) {
      throw new Error("Account not found");
    }

    const patch: Record<string, unknown> = {};

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Account name is required");
      patch.name = name;
    }
    if (args.broker !== undefined) patch.broker = args.broker.trim() || "Broker";
    if (args.type !== undefined) patch.type = args.type;
    if (args.currency !== undefined) patch.currency = args.currency;
    if (args.startingBalance !== undefined) {
      if (!Number.isFinite(args.startingBalance) || args.startingBalance < 0) {
        throw new Error("Starting balance must be a number that is 0 or more");
      }
      patch.startingBalance = args.startingBalance;
    }

    if (args.isDefault === true && !account.isDefault) {
      const all = await ctx.db
        .query("accounts")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const acc of all) {
        if (acc._id !== args.accountId && acc.isDefault) {
          await ctx.db.patch(acc._id, { isDefault: false });
        }
      }
      patch.isDefault = true;
      await ctx.db.patch(user._id, { defaultAccountId: args.accountId });
    }

    await ctx.db.patch(args.accountId, patch);

    if (args.startingBalance !== undefined) {
      await recalcAccountBalance(ctx, args.accountId);
    }

    return args.accountId;
  },
});

export const deleteAccount = mutation({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== user._id) {
      throw new Error("Account not found");
    }

    const all = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (all.length <= 1) {
      throw new Error("You must keep at least one trading account");
    }

    // Delete this account's trades (and their screenshot files)
    const trades = await ctx.db
      .query("trades")
      .withIndex("by_user_account", (q) =>
        q.eq("userId", user._id).eq("accountId", args.accountId)
      )
      .collect();

    for (const trade of trades) {
      for (const shot of trade.screenshots) {
        await ctx.storage.delete(shot.storageId);
      }
      await ctx.db.delete(trade._id);
    }

    await ctx.db.delete(args.accountId);

    // Keep exactly one default account
    if (account.isDefault) {
      const next = all.find((a) => a._id !== args.accountId);
      if (next) {
        await ctx.db.patch(next._id, { isDefault: true });
        await ctx.db.patch(user._id, { defaultAccountId: next._id });
      }
    }
  },
});
