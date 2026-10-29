import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthedUser } from "./helpers";

// Get all goals for the signed-in user
export const getUserGoals = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUser(ctx);
    const goals = await ctx.db
      .query("goals")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Sort by completed status (incomplete first), then by deadline
    return goals.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      return 0;
    });
  },
});

// Create new goal
export const createGoal = mutation({
  args: {
    title: v.string(),
    category: v.string(),
    targetValue: v.number(),
    currentValue: v.number(),
    unit: v.string(),
    period: v.string(),
    deadline: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    isHardRiskLimit: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);

    const goalId = await ctx.db.insert("goals", {
      userId: user._id,
      title: args.title,
      category: args.category,
      targetValue: args.targetValue,
      currentValue: args.currentValue,
      unit: args.unit,
      period: args.period,
      deadline: args.deadline,
      completed: args.completed ?? false,
      notes: args.notes,
      isHardRiskLimit: args.isHardRiskLimit,
    });

    return goalId;
  },
});

// Update goal
export const updateGoal = mutation({
  args: {
    goalId: v.id("goals"),
    title: v.optional(v.string()),
    category: v.optional(v.string()),
    targetValue: v.optional(v.number()),
    currentValue: v.optional(v.number()),
    unit: v.optional(v.string()),
    period: v.optional(v.string()),
    deadline: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    isHardRiskLimit: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    const { goalId, ...updates } = args;

    const goal = await ctx.db.get(goalId);
    if (!goal || goal.userId !== user._id) throw new Error("Goal not found");

    const fieldsToUpdate: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fieldsToUpdate[key] = value;
      }
    }

    await ctx.db.patch(goalId, fieldsToUpdate);
    return goalId;
  },
});

// Delete goal
export const deleteGoal = mutation({
  args: { goalId: v.id("goals") },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.userId !== user._id) return;

    await ctx.db.delete(args.goalId);
    return args.goalId;
  },
});

// Update goal progress
export const updateGoalProgress = mutation({
  args: {
    goalId: v.id("goals"),
    currentValue: v.number(),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUser(ctx);
    const goal = await ctx.db.get(args.goalId);

    if (!goal || goal.userId !== user._id) {
      throw new Error("Goal not found");
    }

    // Auto-complete if target reached
    const isCompleted =
      args.completed !== undefined
        ? args.completed
        : args.currentValue >= goal.targetValue;

    await ctx.db.patch(args.goalId, {
      currentValue: args.currentValue,
      completed: isCompleted,
    });

    return args.goalId;
  },
});
