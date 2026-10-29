import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { requireAdmin } from "./helpers";

const API = "https://api.ayrshare.com/api";
// TraderVault platform id → Ayrshare platform id (WhatsApp isn't supported by posting services).
const AY: Record<string, string> = { facebook: "facebook", instagram: "instagram", linkedin: "linkedin", x: "twitter" };
const ADS: Record<string, string> = { "01": "launch", "02": "ai-coach", "03": "prop-firm", "04": "screenshot-import", "05": "tradingview-sync", "06": "analytics", "07": "backtesting", "08": "pine-scripts", "09": "share-link", "10": "leaderboard", "11": "psychology", "12": "cta" };

// Never returns the key — only whether one is saved.
export const status = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await ctx.db.query("socialConnections").withIndex("by_platform", (q) => q.eq("platform", "ayrshare")).first();
    return row ? { connected: true, name: row.name, connectedAt: row.connectedAt } : { connected: false, name: "", connectedAt: 0 };
  },
});

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    for (const r of await ctx.db.query("socialConnections").withIndex("by_platform", (q) => q.eq("platform", "ayrshare")).collect()) await ctx.db.delete(r._id);
  },
});

export const saveKey = internalMutation({
  args: { key: v.string(), name: v.string() },
  handler: async (ctx, { key, name }) => {
    for (const r of await ctx.db.query("socialConnections").withIndex("by_platform", (q) => q.eq("platform", "ayrshare")).collect()) await ctx.db.delete(r._id);
    await ctx.db.insert("socialConnections", { platform: "ayrshare", accessToken: key, expiresAt: 0, memberUrn: "", name, connectedAt: Date.now() });
  },
});

export const getKey = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("socialConnections").withIndex("by_platform", (q) => q.eq("platform", "ayrshare")).first())?.accessToken ?? null,
});

const callUser = async (key: string) => {
  const res = await fetch(`${API}/user`, { headers: { Authorization: `Bearer ${key}` } });
  const j: any = await res.json().catch(() => ({}));
  return { ok: res.ok && j?.status !== "error", j };
};

// Owner pastes the one key from their posting-service dashboard; we check it works and which accounts are linked.
export const connect = action({
  args: { key: v.string() },
  handler: async (ctx, { key }): Promise<string[]> => {
    await ctx.runQuery(api.marketing.isAdmin, {});
    const k = key.trim();
    if (k.length < 10) throw new Error("That doesn't look like an API key.");
    const { ok, j } = await callUser(k);
    if (!ok) throw new Error("That key didn't work — copy it again from your Ayrshare dashboard.");
    const accounts: string[] = j.activeSocialAccounts ?? [];
    await ctx.runMutation(internal.social.saveKey, { key: k, name: accounts.length ? accounts.join(", ") : "No accounts linked yet" });
    return accounts;
  },
});

// Live list of linked social accounts.
export const accounts = action({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    await ctx.runQuery(api.marketing.isAdmin, {});
    const key = await ctx.runQuery(internal.social.getKey, {});
    if (!key) return [];
    const { ok, j } = await callUser(key);
    if (!ok) throw new Error("Your posting-service key stopped working — reconnect it.");
    return j.activeSocialAccounts ?? [];
  },
});

// Publishes ONE queued post. Only runs when the owner presses "Post now" on that post.
export const postNow = action({
  args: { postId: v.id("marketingPosts") },
  handler: async (ctx, { postId }) => {
    await ctx.runQuery(api.marketing.isAdmin, {});
    const post = (await ctx.runQuery(api.marketing.list, {})).find((p) => p._id === postId);
    if (!post) throw new Error("Post not found.");
    if (post.status === "posted") throw new Error("Already posted.");
    const platform = AY[post.platform];
    if (!platform) throw new Error("This platform can't be posted automatically — use the Post on… button.");
    if (post.platform === "instagram" && !post.image) throw new Error("Instagram posts need an ad image.");
    const key = await ctx.runQuery(internal.social.getKey, {});
    if (!key) throw new Error("Connect your posting service first.");
    const app = process.env.APP_URL ?? "https://trader-vault-omega.vercel.app";
    const res = await fetch(`${API}/post`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        post: post.caption,
        platforms: [platform],
        ...(post.image && ADS[post.image] ? { mediaUrls: [`${app}/ads/tradevault-ad-${post.image}-${ADS[post.image]}.png`] } : {}),
      }),
    });
    const j: any = await res.json().catch(() => ({}));
    const failed = !res.ok || j?.status === "error" || (j?.postIds ?? []).some((x: any) => x?.status === "error");
    if (failed) {
      const why = j?.message ?? (j?.postIds ?? []).find((x: any) => x?.message)?.message ?? `status ${res.status}`;
      throw new Error(`Post failed: ${String(why).slice(0, 140)}`);
    }
    await ctx.runMutation(api.marketing.setStatus, { id: postId, status: "posted" });
    return true;
  },
});
