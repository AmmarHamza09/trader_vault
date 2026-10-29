import { internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAdmin, recalcAccountBalance } from "./helpers";

const DAY = 24 * 3600 * 1000;

// ---- client error reports (from the browser, even when React has crashed) ------------------
export const logError = internalMutation({
  args: { message: v.string(), stack: v.optional(v.string()), url: v.optional(v.string()), ua: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const message = a.message.slice(0, 300);
    const fingerprint = `${message}|${(a.stack ?? "").split("\n")[1]?.trim().slice(0, 120) ?? ""}`;
    const existing = await ctx.db.query("errorLogs").withIndex("by_fingerprint", (q) => q.eq("fingerprint", fingerprint)).first();
    if (existing) await ctx.db.patch(existing._id, { count: existing.count + 1, lastSeen: Date.now() });
    else
      await ctx.db.insert("errorLogs", {
        fingerprint,
        message,
        stack: a.stack?.slice(0, 1500),
        url: a.url?.slice(0, 200),
        ua: a.ua?.slice(0, 160),
        count: 1,
        lastSeen: Date.now(),
      });
  },
});

// ---- AI health: written by the 5-minute checker, read by every AI action ---------------------
export const aiOrder = internalQuery({
  args: {},
  handler: async (ctx) => {
    const st = await ctx.db.query("aiState").first();
    return st && Date.now() - st.checkedAt < 30 * 60 * 1000 ? st.order : null;
  },
});

export const saveAiState = internalMutation({
  args: {
    order: v.array(v.string()),
    results: v.array(v.object({ model: v.string(), ok: v.boolean(), ms: v.number(), error: v.optional(v.string()) })),
  },
  handler: async (ctx, a) => {
    const okCount = a.results.filter((r) => r.ok).length;
    const prev = await ctx.db.query("aiState").first();
    const failStreak = okCount === 0 ? (prev?.failStreak ?? 0) + 1 : 0;
    const doc = { order: a.order, results: a.results, checkedAt: Date.now(), failStreak };
    if (prev) await ctx.db.patch(prev._id, doc);
    else await ctx.db.insert("aiState", doc);
    await ctx.db.insert("healthChecks", {
      kind: "ai",
      ok: okCount > 0,
      detail: okCount > 0 ? `${okCount}/${a.results.length} models healthy · best ${a.order[0]}` : "all AI models failing",
      ms: a.results.find((r) => r.ok)?.ms,
    });
    // alert admins once when the AI has been fully down for 2 checks in a row
    if (okCount === 0 && failStreak === 2) {
      const admins = (await ctx.db.query("users").collect()).filter((u) => u.isAdmin);
      for (const u of admins)
        await ctx.scheduler.runAfter(0, internal.pushSend.sendToUser, {
          userId: u._id,
          title: "⚠️ AI service is down",
          body: "All Gemini models are failing. The system keeps retrying every 5 minutes automatically.",
          tag: "ai-down",
        });
    }
  },
});

// ---- hourly data self-repair ---------------------------------------------------------------------
export const selfHeal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("accounts").take(400);
    let fixed = 0;
    for (const acc of accounts) {
      const before = acc.currentBalance;
      await recalcAccountBalance(ctx, acc._id);
      const after = (await ctx.db.get(acc._id))?.currentBalance;
      if (after !== before) fixed++;
    }
    await ctx.db.insert("healthChecks", {
      kind: "data",
      ok: true,
      detail: `${accounts.length} accounts verified, ${fixed} corrected`,
    });
    // housekeeping
    for (const e of await ctx.db.query("errorLogs").collect()) if (Date.now() - e.lastSeen > 14 * DAY) await ctx.db.delete(e._id);
    for (const h of await ctx.db.query("healthChecks").collect()) if (Date.now() - h._creationTime > 3 * DAY) await ctx.db.delete(h._id);
  },
});

// ---- admin dashboard -----------------------------------------------------------------------------------
export const adminStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const ai = await ctx.db.query("aiState").first();
    const checks = await ctx.db.query("healthChecks").order("desc").take(30);
    const errors = (await ctx.db.query("errorLogs").collect()).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 15);
    return {
      ai: ai ? { order: ai.order, results: ai.results, checkedAt: ai.checkedAt, failStreak: ai.failStreak } : null,
      lastData: checks.find((c) => c.kind === "data") ?? null,
      errors: errors.map((e) => ({ _id: e._id, message: e.message, url: e.url, count: e.count, lastSeen: e.lastSeen })),
    };
  },
});
