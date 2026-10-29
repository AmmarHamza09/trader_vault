import { query, mutation, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { requireAdmin, requireAuthedUser, planOf, logAdminAction } from "./helpers";

const LS = "https://api.lemonsqueezy.com/v1";
const APP_URL = () => process.env.APP_URL ?? "https://trader-vault-omega.vercel.app";

// The signed-in user's entitlement, for the UI.
export const myPlan = query({
  args: {},
  handler: async (ctx) => {
    const u = await requireAuthedUser(ctx);
    const p = planOf(u);
    return {
      plan: p.plan,
      source: p.source,
      status: u.subStatus ?? null,
      renewsAt: u.subRenewsAt ?? null,
      endsAt: u.subEndsAt ?? null,
      portalUrl: u.lsPortalUrl ?? null,
      billingReady: !!(process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID),
    };
  },
});

export const setSuperUser = mutation({
  args: { userId: v.id("users"), superUser: v.boolean() },
  handler: async (ctx, { userId, superUser }) => {
    const admin = await requireAdmin(ctx);
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("User not found");
    await ctx.db.patch(userId, { superUser });
    await logAdminAction(ctx, { actor: admin, action: superUser ? "grant_super_user" : "revoke_super_user", target });
  },
});

// Admin comp / override: give someone a plan without a subscription (null clears it).
export const setPlanManual = mutation({
  args: { userId: v.id("users"), plan: v.union(v.literal("pro"), v.literal("elite"), v.null()) },
  handler: async (ctx, { userId, plan }) => {
    const admin = await requireAdmin(ctx);
    if (plan) await ctx.db.patch(userId, { plan, subStatus: "comped", subEndsAt: undefined, subRenewsAt: undefined });
    else await ctx.db.patch(userId, { plan: undefined, subStatus: undefined, subEndsAt: undefined, subRenewsAt: undefined });
    const target = await ctx.db.get(userId);
    await logAdminAction(ctx, { actor: admin, action: plan ? `comp_${plan}` : "clear_plan", target });
  },
});

// One-time: everyone who already has an account becomes a super user (free, full access).
// Run once with:  npx convex run billing:grandfatherAll
export const grandfatherAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    let n = 0;
    for (const u of await ctx.db.query("users").collect()) {
      if (!u.superUser) { await ctx.db.patch(u._id, { superUser: true }); n++; }
    }
    return n;
  },
});

// Called by the Lemon Squeezy webhook.
export const applySubscription = internalMutation({
  args: {
    userId: v.optional(v.string()),
    subscriptionId: v.string(),
    customerId: v.string(),
    status: v.string(),
    plan: v.optional(v.string()),
    renewsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    portalUrl: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    let user = a.userId ? (() => { const id = ctx.db.normalizeId("users", a.userId!); return id; })() : null;
    let doc = user ? await ctx.db.get(user) : null;
    if (!doc) doc = await ctx.db.query("users").withIndex("by_ls_sub", (q) => q.eq("lsSubscriptionId", a.subscriptionId)).first();
    if (!doc) return false;
    await ctx.db.patch(doc._id, {
      lsSubscriptionId: a.subscriptionId,
      lsCustomerId: a.customerId,
      subStatus: a.status,
      ...(a.plan ? { plan: a.plan } : {}),
      subRenewsAt: a.renewsAt,
      subEndsAt: a.endsAt,
      ...(a.portalUrl ? { lsPortalUrl: a.portalUrl } : {}),
    });
    return true;
  },
});

export const planForVariant = (variantId: string): string | undefined => {
  const map: Record<string, string | undefined> = {
    [process.env.LS_VARIANT_PRO_MONTHLY ?? "-"]: "pro", [process.env.LS_VARIANT_PRO_YEARLY ?? "-"]: "pro",
    [process.env.LS_VARIANT_ELITE_MONTHLY ?? "-"]: "elite", [process.env.LS_VARIANT_ELITE_YEARLY ?? "-"]: "elite",
  };
  return map[variantId];
};

// Creates a hosted Lemon Squeezy checkout for the signed-in user and returns its URL.
export const createCheckout = action({
  args: { plan: v.union(v.literal("pro"), v.literal("elite")), interval: v.union(v.literal("monthly"), v.literal("yearly")) },
  handler: async (ctx, { plan, interval }): Promise<string> => {
    const me = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!me) throw new Error("Please sign in first.");
    if (me.isAdmin || me.superUser) throw new Error("You already have full access as a super user.");
    const key = process.env.LEMONSQUEEZY_API_KEY, store = process.env.LEMONSQUEEZY_STORE_ID;
    const variant = variantFor(plan, interval);
    if (!key || !store || !variant) throw new Error("Payments aren't switched on yet — please try again soon.");
    const res = await fetch(`${LS}/checkouts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json" },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: { email: me.email, name: me.name, custom: { user_id: me._id } },
            product_options: { redirect_url: `${APP_URL()}/?billing=success` },
          },
          relationships: { store: { data: { type: "stores", id: String(store) } }, variant: { data: { type: "variants", id: String(variant) } } },
        },
      }),
    });
    const j: any = await res.json().catch(() => ({}));
    const url = j?.data?.attributes?.url;
    if (!res.ok || !url) throw new Error("Couldn't start checkout — please try again.");
    return url;
  },
});

// Read env at call time (not module load) so newly set variables apply immediately.
function variantFor(plan: string, interval: string): string | undefined {
  const env = process.env;
  const map: Record<string, string | undefined> = {
    "pro:monthly": env.LS_VARIANT_PRO_MONTHLY,
    "pro:yearly": env.LS_VARIANT_PRO_YEARLY,
    "elite:monthly": env.LS_VARIANT_ELITE_MONTHLY,
    "elite:yearly": env.LS_VARIANT_ELITE_YEARLY,
  };
  return map[`${plan}:${interval}`];
}
