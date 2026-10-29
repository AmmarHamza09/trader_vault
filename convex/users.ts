import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAuthedUser } from "./helpers";

// Get the Convex user record for the currently signed-in user. The row is
// created automatically at sign-up time (see the createOrUpdateUser
// callback in auth.ts), so this just reads it.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

// Update the signed-in user's own profile.
export const updateUser = mutation({
  args: {
    name: v.optional(v.string()),
    avatar: v.optional(v.string()),
    bio: v.optional(v.string()),
    preferredInstruments: v.optional(v.array(v.string())),
    currency: v.optional(v.string()),
    timezone: v.optional(v.string()),
    defaultRiskPercentage: v.optional(v.number()),
    defaultAccountBalance: v.optional(v.number()),
    theme: v.optional(v.string()),
    leaderboardVisible: v.optional(v.boolean()),
    defaultAccountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);

    const fieldsToUpdate: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined) {
        fieldsToUpdate[key] = value;
      }
    }

    await ctx.db.patch(user._id, fieldsToUpdate);
    return user._id;
  },
});

// Screenshot clock settings: hours to ADD to the time shown in a TradingView / MT5 screenshot to get Pakistan time.
export const getTimeOffsets = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { tv: 7, mt5: 0 };
    const u = await ctx.db.get(userId);
    return { tv: u?.tvTimeOffsetHours ?? 7, mt5: u?.mt5TimeOffsetHours ?? 0 };
  },
});

export const setTimeOffsets = mutation({
  args: { tv: v.number(), mt5: v.number() },
  handler: async (ctx, { tv, mt5 }) => {
    const user = await requireAuthedUser(ctx);
    const clamp = (n: number) => Math.max(-14, Math.min(14, Math.round(n * 2) / 2));
    await ctx.db.patch(user._id, { tvTimeOffsetHours: clamp(tv), mt5TimeOffsetHours: clamp(mt5) });
  },
});

// Step 1 of an avatar upload: the browser POSTs the image file to this URL.
export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuthedUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Step 2: resolve the uploaded file to a public URL and save it as the
// signed-in user's avatar.
export const setAvatarFromUpload = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const user = await requireAuthedUser(ctx);

    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Uploaded file not found");

    await ctx.db.patch(user._id, { avatar: url });
    return url;
  },
});
