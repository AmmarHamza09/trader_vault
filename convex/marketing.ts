import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./helpers";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("marketingPosts").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return true;
  },
});

export const save = mutation({
  args: {
    id: v.optional(v.id("marketingPosts")),
    platform: v.string(),
    caption: v.string(),
    image: v.string(),
    status: v.string(),
    scheduledFor: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...data }) => {
    await requireAdmin(ctx);
    if (id) {
      await ctx.db.patch(id, data);
      return id;
    }
    return await ctx.db.insert("marketingPosts", { ...data, createdAt: Date.now() });
  },
});

export const setStatus = mutation({
  args: { id: v.id("marketingPosts"), status: v.string() },
  handler: async (ctx, { id, status }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(id, { status });
  },
});

export const remove = mutation({
  args: { id: v.id("marketingPosts") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
  },
});
