import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthedUser, requirePlan } from "./helpers";
import { activatePhaseDoc, evaluate, refreshPhases, r2, todayPKT } from "./phaseLogic";

export const getUserPhases = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUser(ctx);
    const phases = await ctx.db.query("phases").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const trades = await ctx.db.query("trades").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const accounts = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();

    const out = [];
    for (const p of phases.filter((x) => !x.archived)) {
      const images = await Promise.all(
        (p.images ?? []).map(async (im) => ({ ...im, url: (await ctx.storage.getUrl(im.storageId)) ?? "" }))
      );
      out.push({ ...p, images, progress: evaluate(p, trades, accounts) });
    }
    return out.sort(
      (a, b) => (a.stageOrder ?? 0) - (b.stageOrder ?? 0) || a._creationTime - b._creationTime
    );
  },
});

const phaseArgs = {
  name: v.string(),
  accountId: v.id("accounts"),
  startBalance: v.number(),
  targetBalance: v.number(),
  dailyProfitTarget: v.optional(v.number()),
  maxDailyLoss: v.optional(v.number()),
  maxTotalLoss: v.optional(v.number()),
  firm: v.optional(v.string()),
  stage: v.optional(v.string()),
  drawdownType: v.optional(v.string()),
  trailingLock: v.optional(v.boolean()),
  instant: v.optional(v.boolean()),
};

export const createPhase = mutation({
  args: phaseArgs,
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    requirePlan(user, "pro", "Prop-firm phase tracking");
    if (!args.name.trim()) throw new Error("Give the phase a name.");
    if (!args.instant && args.targetBalance <= args.startBalance) throw new Error("Target must be above the starting balance.");
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== user._id) throw new Error("Account not found");

    const id = await ctx.db.insert("phases", {
      userId: user._id,
      ...args,
      name: args.name.trim(),
      startDate: todayPKT(),
      startedAt: Date.now(),
      status: "active",
      archived: false,
      stageOrder: args.instant ? 1 : args.stage === "Phase 2" ? 2 : args.stage?.startsWith("Funded") ? 3 : 1,
      peakBalance: args.startBalance,
    });
    await refreshPhases(ctx, user._id);
    return id;
  },
});

// Creates a whole prop-firm challenge (Phase 1 → Phase 2 → Funded/Payout) in one go.
// Only the first stage is active; the rest unlock automatically when the previous passes.
export const createChallenge = mutation({
  args: {
    firm: v.string(),
    accountId: v.id("accounts"),
    accountSize: v.number(),
    stages: v.array(
      v.object({
        stage: v.string(),
        targetPct: v.number(),
        dailyLossPct: v.optional(v.number()),
        maxLossPct: v.optional(v.number()),
        dailyProfitPct: v.optional(v.number()),
      })
    ),
    imageStorageId: v.optional(v.id("_storage")),
    drawdownType: v.optional(v.string()),
    trailingLock: v.optional(v.boolean()),
    instant: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    requirePlan(user, "pro", "Prop-firm phase tracking");
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== user._id) throw new Error("Account not found");
    if (args.stages.length === 0) throw new Error("No stages to create.");

    const size = args.accountSize;
    let prev: any = undefined;
    let order = 0;
    for (const st of args.stages) {
      order += 1;
      const id = await ctx.db.insert("phases", {
        userId: user._id,
        accountId: args.accountId,
        name: `${args.firm} — ${st.stage}`,
        firm: args.firm,
        stage: st.stage,
        stageOrder: order,
        startBalance: size,
        targetBalance: r2(size * (1 + st.targetPct / 100)),
        dailyProfitTarget: st.dailyProfitPct ? r2((size * st.dailyProfitPct) / 100) : undefined,
        maxDailyLoss: st.dailyLossPct ? r2((size * st.dailyLossPct) / 100) : undefined,
        maxTotalLoss: st.maxLossPct ? r2((size * st.maxLossPct) / 100) : undefined,
        startDate: todayPKT(),
        startedAt: Date.now(),
        status: order === 1 ? "active" : "upcoming",
        archived: false,
        prevPhaseId: prev,
        drawdownType: args.drawdownType === "trailing" ? "trailing" : "static",
        trailingLock: args.drawdownType === "trailing" ? args.trailingLock : undefined,
        instant: args.instant || undefined,
        peakBalance: size,
        images: order === 1 && args.imageStorageId ? [{ storageId: args.imageStorageId }] : undefined,
      });
      prev = id;
    }
    await refreshPhases(ctx, user._id);
  },
});

export const addPhaseImage = mutation({
  args: { phaseId: v.id("phases"), storageId: v.id("_storage") },
  handler: async (ctx, { phaseId, storageId }) => {
    const user = await requireAuthedUser(ctx);
    const phase = await ctx.db.get(phaseId);
    if (!phase || phase.userId !== user._id) throw new Error("Phase not found");
    await ctx.db.patch(phaseId, { images: [...(phase.images ?? []), { storageId }] });
  },
});

export const setPhaseAccount = mutation({
  args: { phaseId: v.id("phases"), accountId: v.id("accounts") },
  handler: async (ctx, { phaseId, accountId }) => {
    const user = await requireAuthedUser(ctx);
    const phase = await ctx.db.get(phaseId);
    const account = await ctx.db.get(accountId);
    if (!phase || phase.userId !== user._id || !account || account.userId !== user._id) throw new Error("Not found");
    if (phase.status === "passed" || phase.status === "failed") throw new Error("This phase is locked.");
    await ctx.db.patch(phaseId, { accountId });
    await refreshPhases(ctx, user._id);
  },
});

// Manually start an upcoming phase (e.g. when it's a new account login).
export const activatePhase = mutation({
  args: { phaseId: v.id("phases") },
  handler: async (ctx, { phaseId }) => {
    const user = await requireAuthedUser(ctx);
    const phase = await ctx.db.get(phaseId);
    if (!phase || phase.userId !== user._id) throw new Error("Phase not found");
    if (phase.status !== "upcoming") return;
    const accounts = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    await activatePhaseDoc(ctx, phase, accounts);
  },
});

export const deletePhase = mutation({
  args: { phaseId: v.id("phases") },
  handler: async (ctx, { phaseId }) => {
    const user = await requireAuthedUser(ctx);
    const phase = await ctx.db.get(phaseId);
    if (!phase || phase.userId !== user._id) return;
    for (const im of phase.images ?? []) await ctx.storage.delete(im.storageId);
    await ctx.db.delete(phaseId);
  },
});

// Unlock + restart tracking from today (e.g. after an account reset / retry).
export const resetPhase = mutation({
  args: { phaseId: v.id("phases"), startBalance: v.optional(v.number()) },
  handler: async (ctx, { phaseId, startBalance }) => {
    const user = await requireAuthedUser(ctx);
    const phase = await ctx.db.get(phaseId);
    if (!phase || phase.userId !== user._id) throw new Error("Phase not found");
    await ctx.db.patch(phaseId, {
      status: "active",
      startDate: todayPKT(),
      startedAt: Date.now(),
      startBalance: startBalance ?? phase.startBalance,
      lockedBalance: undefined,
      lockedAt: undefined,
      failReason: undefined,
      peakBalance: undefined,
    });
  },
});
