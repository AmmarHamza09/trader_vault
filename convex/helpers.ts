import { getAuthUserId } from "@convex-dev/auth/server";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { refreshPhases } from "./phaseLogic";

/**
 * Resolves the Convex user document for the signed-in user. The user row is
 * created automatically by the Convex Auth sign-up callback (see auth.ts),
 * so this should always find a record once authenticated.
 */
export async function requireAuthedUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");

  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User record not found");
  if (user.isBlocked) throw new Error("Your account has been blocked by an administrator.");
  return user;
}

/**
 * Resolves the caller's user document and verifies they are an admin.
 * Throws if unauthenticated, blocked, or not an admin.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await requireAuthedUser(ctx);
  if (!user.isAdmin) throw new Error("Admin access required");
  return user;
}

/**
 * Records an admin action (block/unblock/delete/grant-admin/etc.) to the
 * audit log. Fire-and-forget from the caller's perspective — never throws.
 */
export async function logAdminAction(
  ctx: MutationCtx,
  params: {
    actor: Doc<"users">;
    action: string;
    target?: Doc<"users"> | null;
    targetEmail?: string;
    details?: string;
  }
): Promise<void> {
  await ctx.db.insert("adminAuditLogs", {
    actorUserId: params.actor._id,
    actorEmail: params.actor.email,
    action: params.action,
    targetUserId: params.target?._id,
    targetEmail: params.target?.email ?? params.targetEmail,
    details: params.details,
  });
}

/**
 * Recomputes an account's currentBalance as startingBalance + sum of all its trades' netPnL.
 * Call after any trade create / update / delete.
 */
export async function recalcAccountBalance(
  ctx: MutationCtx,
  accountId: Id<"accounts">
): Promise<void> {
  const account = await ctx.db.get(accountId);
  if (!account) return;

  const trades = await ctx.db
    .query("trades")
    .withIndex("by_user_account", (q) =>
      q.eq("userId", account.userId).eq("accountId", accountId)
    )
    .collect();

  const total = trades.reduce((sum, t) => sum + t.netPnL, 0);
  await ctx.db.patch(accountId, {
    currentBalance: Math.round((account.startingBalance + total) * 100) / 100,
  });
  await refreshPhases(ctx, account.userId);
}
export type Plan = "starter" | "pro" | "elite";
const RANK: Record<Plan, number> = { starter: 0, pro: 1, elite: 2 };
const LIVE = ["active", "on_trial", "past_due", "comped"];

// What the user is entitled to right now. Admins and super users get everything for free;
// everyone else gets what their paid subscription covers (a cancelled plan runs until its paid-through date).
export function planOf(u: Doc<"users">): { plan: Plan; source: "super" | "subscription" | "free"; status?: string } {
  if (u.isAdmin || u.superUser) return { plan: "elite", source: "super" };
  const paid = u.plan === "pro" || u.plan === "elite" ? (u.plan as Plan) : null;
  if (paid && u.subStatus) {
    if (LIVE.includes(u.subStatus)) return { plan: paid, source: "subscription", status: u.subStatus };
    if (u.subStatus === "cancelled" && (u.subEndsAt ?? 0) > Date.now()) return { plan: paid, source: "subscription", status: u.subStatus };
  }
  return { plan: "starter", source: "free", status: u.subStatus };
}

export function requirePlan(u: Doc<"users">, min: Plan, what: string) {
  if (RANK[planOf(u).plan] < RANK[min]) {
    throw new Error(`${what} is a ${min === "elite" ? "Elite" : "Pro"} feature — upgrade in Settings → Plan & billing.`);
  }
}
