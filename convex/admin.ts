import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, logAdminAction, planOf } from "./helpers";

// Most recent admin actions, newest first, for the audit log view.
export const listAuditLogs = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("adminAuditLogs").order("desc").take(200);
  },
});

// List every user on the platform, with a quick activity summary, for the
// admin dashboard's user table.
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const users = await ctx.db.query("users").collect();

    return await Promise.all(
      users.map(async (u) => {
        const trades = await ctx.db
          .query("trades")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .collect();
        const accounts = await ctx.db
          .query("accounts")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .collect();

        return {
          _id: u._id,
          _creationTime: u._creationTime,
          name: u.name,
          email: u.email,
          avatar: u.avatar,
          isAdmin: !!u.isAdmin,
          isBlocked: !!u.isBlocked,
          superUser: !!u.superUser,
          plan: planOf(u).plan,
          planSource: planOf(u).source,
          tradeCount: trades.length,
          accountCount: accounts.length,
          totalNetPnL: trades.reduce((sum, t) => sum + t.netPnL, 0),
        };
      })
    );
  },
});

// Everything needed to render a user's full, read-only dashboard in the
// admin UI: profile, every account, every trade, and every goal.
export const getUserFullDashboard = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const trades = await ctx.db
      .query("trades")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const tradesWithScreenshotUrls = await Promise.all(
      trades.map(async (t) => ({
        ...t,
        screenshots: await Promise.all(
          t.screenshots.map(async (s) => ({
            ...s,
            url: (await ctx.storage.getUrl(s.storageId)) ?? "",
          }))
        ),
      }))
    );

    const goals = await ctx.db
      .query("goals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return { user, accounts, trades: tradesWithScreenshotUrls, goals };
  },
});

// Full detail for one user: profile, accounts, and recent trades — for the
// admin dashboard's user detail panel.
export const getUserDetail = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const trades = await ctx.db
      .query("trades")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    const goals = await ctx.db
      .query("goals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return { user, accounts, trades, goals };
  },
});

export const blockUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const admin = await requireAdmin(ctx);
    if (userId === admin._id) throw new Error("You can't block your own account.");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(userId, { isBlocked: true });
    await logAdminAction(ctx, { actor: admin, action: "block_user", target: user });
  },
});

// Grants or revokes admin access for a user.
export const setAdmin = mutation({
  args: { userId: v.id("users"), isAdmin: v.boolean() },
  handler: async (ctx, { userId, isAdmin }) => {
    const admin = await requireAdmin(ctx);
    if (userId === admin._id && !isAdmin) {
      throw new Error("You can't remove your own admin access.");
    }

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(userId, { isAdmin });
    await logAdminAction(ctx, {
      actor: admin,
      action: isAdmin ? "grant_admin" : "revoke_admin",
      target: user,
    });
  },
});

export const unblockUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const admin = await requireAdmin(ctx);

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(userId, { isBlocked: false });
    await logAdminAction(ctx, { actor: admin, action: "unblock_user", target: user });
  },
});

// Permanently deletes a user and all of their trading data (trades,
// accounts, goals, competition entries). Also bans their Clerk ID so they
// can't just sign back in and get a fresh record created.
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const admin = await requireAdmin(ctx);
    if (userId === admin._id) throw new Error("You can't delete your own account.");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const trades = await ctx.db
      .query("trades")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const trade of trades) {
      for (const shot of trade.screenshots) {
        await ctx.storage.delete(shot.storageId);
      }
      await ctx.db.delete(trade._id);
    }

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const account of accounts) {
      await ctx.db.delete(account._id);
    }

    const goals = await ctx.db
      .query("goals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const goal of goals) {
      await ctx.db.delete(goal._id);
    }

    const phases = await ctx.db
      .query("phases")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const ph of phases) {
      await ctx.db.delete(ph._id);
    }


    const shareRows = await ctx.db.query("shares").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const sh of shareRows) await ctx.db.delete(sh._id);

    const participations = await ctx.db
      .query("competitionParticipants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const p of participations) {
      await ctx.db.delete(p._id);
    }

    const authAccounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const a of authAccounts) {
      await ctx.db.delete(a._id);
    }

    const authSessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const s of authSessions) {
      await ctx.db.delete(s._id);
    }

    await ctx.db.insert("bannedEmails", {
      email: user.email,
      bannedAt: Date.now(),
    });

    await logAdminAction(ctx, {
      actor: admin,
      action: "delete_user",
      target: user,
      details: `${trades.length} trade(s), ${accounts.length} account(s), ${goals.length} goal(s) deleted`,
    });

    await ctx.db.delete(userId);
  },
});
