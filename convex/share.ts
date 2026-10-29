import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthedUser, requirePlan } from "./helpers";

const newToken = () => {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

// The owner's share links, one per account at most.
export const getMyShares = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUser(ctx);
    const rows = await ctx.db.query("shares").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    return rows.map((r) => ({ accountId: r.accountId, token: r.token }));
  },
});

export const createShare = mutation({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }) => {
    const user = await requireAuthedUser(ctx);
    requirePlan(user, "pro", "Share links");
    const acc = await ctx.db.get(accountId);
    if (!acc || acc.userId !== user._id) throw new Error("Account not found");
    const rows = await ctx.db.query("shares").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const existing = rows.find((r) => r.accountId === accountId);
    if (existing) return existing.token;
    const token = newToken();
    await ctx.db.insert("shares", { userId: user._id, accountId, token });
    return token;
  },
});

// Revoke (or revoke + re-issue with regenerate) — the old link stops working immediately.
export const revokeShare = mutation({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, { accountId }) => {
    const user = await requireAuthedUser(ctx);
    const rows = await ctx.db.query("shares").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    for (const r of rows.filter((x) => x.accountId === accountId)) await ctx.db.delete(r._id);
  },
});

// Public (no login): read-only dashboard data for ONE shared account. No email,
// no other accounts, no goals/coach/API keys.
export const getSharedDashboard = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const share = await ctx.db.query("shares").withIndex("by_token", (q) => q.eq("token", token)).unique();
    if (!share) return null;
    const user = await ctx.db.get(share.userId);
    const account = await ctx.db.get(share.accountId);
    if (!user || !account || account.userId !== user._id) return null;

    const trades = (await ctx.db.query("trades").withIndex("by_user", (q) => q.eq("userId", user._id)).collect()).filter(
      (t) => t.accountId === account._id
    );
    const withUrls = await Promise.all(
      trades.map(async (t) => ({
        ...t,
        screenshots: await Promise.all(
          t.screenshots.map(async (s) => ({ ...s, url: (await ctx.storage.getUrl(s.storageId)) ?? "" }))
        ),
      }))
    );
    return {
      user: {
        _id: user._id,
        name: user.name,
        email: "",
        avatar: user.avatar,
        bio: user.bio,
        preferredInstruments: user.preferredInstruments,
        defaultAccountId: account._id,
        currency: user.currency,
        timezone: user.timezone,
        defaultRiskPercentage: user.defaultRiskPercentage,
        defaultAccountBalance: user.defaultAccountBalance,
        leaderboardVisible: false,
      },
      accounts: [account],
      trades: withUrls,
      goals: [],
    };
  },
});
