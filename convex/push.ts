import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthedUser } from "./helpers";

// Public half of the VAPID key pair — the browser needs it to subscribe.
export const getPublicKey = query({
  args: {},
  handler: async () => process.env.VAPID_PUBLIC_KEY ?? null,
});

export const saveSubscription = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string() },
  handler: async (ctx, a) => {
    const user = await requireAuthedUser(ctx);
    const existing = await ctx.db.query("pushSubs").withIndex("by_endpoint", (q) => q.eq("endpoint", a.endpoint)).first();
    if (existing) await ctx.db.patch(existing._id, { userId: user._id, p256dh: a.p256dh, auth: a.auth });
    else await ctx.db.insert("pushSubs", { userId: user._id, ...a });
  },
});

export const removeSubscription = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const user = await requireAuthedUser(ctx);
    const row = await ctx.db.query("pushSubs").withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint)).first();
    if (row && row.userId === user._id) await ctx.db.delete(row._id);
  },
});

export const listForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => ctx.db.query("pushSubs").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
});

export const dropByEndpoint = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const row = await ctx.db.query("pushSubs").withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint)).first();
    if (row) await ctx.db.delete(row._id);
  },
});
