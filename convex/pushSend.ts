"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import webpush from "web-push";

// Sends a system notification to every device the user enabled alerts on.
export const sendToUser = internalAction({
  args: { userId: v.id("users"), title: v.string(), body: v.string(), tag: v.optional(v.string()) },
  handler: async (ctx, { userId, title, body, tag }) => {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://trader-vault-omega.vercel.app", pub, priv);
    const subs = await ctx.runQuery(internal.push.listForUser, { userId });
    const payload = JSON.stringify({ title, body, tag: tag ?? "tradevault" });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: "high" });
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) await ctx.runMutation(internal.push.dropByEndpoint, { endpoint: s.endpoint });
        }
      })
    );
  },
});
