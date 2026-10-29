import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Extends Convex Auth's built-in `users` table (which just has name/email/
  // image/etc.) with this app's own trading-profile fields.
  users: defineTable({
    ...authTables.users.validator.fields,
    name: v.string(),
    email: v.string(),
    avatar: v.optional(v.string()),
    bio: v.optional(v.string()),
    preferredInstruments: v.array(v.string()),
    defaultAccountId: v.optional(v.id("accounts")),
    currency: v.string(),
    timezone: v.string(),
    defaultRiskPercentage: v.number(),
    defaultAccountBalance: v.number(),
    theme: v.string(),
    leaderboardVisible: v.boolean(),
    isAdmin: v.optional(v.boolean()),
    isBlocked: v.optional(v.boolean()),
    mt5ApiKey: v.optional(v.string()),
    tvTimeOffsetHours: v.optional(v.number()), // add to TradingView-chart time to get Pakistan time (default 7)
    mt5TimeOffsetHours: v.optional(v.number()), // add to MT5 screenshot time to get Pakistan time (default 0)
    // Billing. superUser = free full access (granted by an admin). plan/subStatus come from the Lemon Squeezy webhook.
    superUser: v.optional(v.boolean()),
    plan: v.optional(v.string()), // "pro" | "elite"
    subStatus: v.optional(v.string()), // active | on_trial | past_due | cancelled | expired | unpaid | paused | comped
    subRenewsAt: v.optional(v.number()),
    subEndsAt: v.optional(v.number()),
    lsCustomerId: v.optional(v.string()),
    lsSubscriptionId: v.optional(v.string()),
    lsPortalUrl: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_ls_sub", ["lsSubscriptionId"])
    .index("by_mt5_key", ["mt5ApiKey"]),

  pushSubs: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  }).index("by_user", ["userId"]).index("by_endpoint", ["endpoint"]),

  errorLogs: defineTable({
    fingerprint: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    url: v.optional(v.string()),
    ua: v.optional(v.string()),
    count: v.number(),
    lastSeen: v.number(),
  }).index("by_fingerprint", ["fingerprint"]),

  healthChecks: defineTable({
    kind: v.string(), // "ai" | "data"
    ok: v.boolean(),
    detail: v.string(),
    ms: v.optional(v.number()),
  }).index("by_kind", ["kind"]),

  aiState: defineTable({
    order: v.array(v.string()),
    results: v.array(v.object({ model: v.string(), ok: v.boolean(), ms: v.number(), error: v.optional(v.string()) })),
    checkedAt: v.number(),
    failStreak: v.number(),
  }),

  tvSignals: defineTable({
    userId: v.id("users"),
    event: v.string(),
    symbol: v.string(),
    side: v.optional(v.string()),
    price: v.number(),
    note: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  tvOpen: defineTable({
    userId: v.id("users"),
    symbol: v.string(),
    side: v.string(),
    price: v.number(),
    sl: v.optional(v.number()),
    tp: v.optional(v.number()),
    lots: v.number(),
    contract: v.number(),
    time: v.number(),
  }).index("by_user", ["userId"]),

  shares: defineTable({
    userId: v.id("users"),
    accountId: v.id("accounts"),
    token: v.string(),
  }).index("by_token", ["token"]).index("by_user", ["userId"]),

  bannedEmails: defineTable({
    email: v.string(),
    bannedAt: v.number(),
  }).index("by_email", ["email"]),

  adminAuditLogs: defineTable({
    actorUserId: v.id("users"),
    actorEmail: v.string(),
    action: v.string(),
    targetUserId: v.optional(v.id("users")),
    targetEmail: v.optional(v.string()),
    details: v.optional(v.string()),
  }),

  accounts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    broker: v.string(),
    type: v.string(),
    currency: v.string(),
    startingBalance: v.number(),
    currentBalance: v.number(),
    isDefault: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_default", ["userId", "isDefault"]),

  trades: defineTable({
    userId: v.id("users"),
    accountId: v.id("accounts"),
    instrument: v.string(),
    direction: v.string(),
    entryDate: v.string(),
    entryTime: v.string(),
    exitDate: v.string(),
    exitTime: v.string(),
    entryPrice: v.number(),
    exitPrice: v.number(),
    stopLoss: v.number(),
    takeProfit: v.number(),
    positionSize: v.number(),
    riskAmount: v.number(),
    potentialReward: v.number(),
    grossPnL: v.number(),
    commission: v.number(),
    swap: v.number(),
    netPnL: v.number(),
    outcome: v.string(),
    rMultiple: v.number(),
    plannedRR: v.number(),
    roiPercentage: v.number(),
    strategy: v.string(),
    timeframe: v.string(),
    session: v.string(),
    setupType: v.string(),
    marketConditions: v.optional(v.string()),
    entryReason: v.string(),
    exitReason: v.string(),
    mistakesMade: v.optional(v.string()),
    lessonsLearned: v.optional(v.string()),
    tags: v.array(v.string()),
    moodBefore: v.string(),
    confidenceLevel: v.number(),
    emotionDuring: v.string(),
    followedPlan: v.boolean(),
    revengeTrade: v.boolean(),
    fomoTrade: v.boolean(),
    mt5Ticket: v.optional(v.string()),
    screenshots: v.array(
      v.object({
        id: v.string(),
        type: v.string(),
        storageId: v.id("_storage"),
        caption: v.optional(v.string()),
      })
    ),
  })
    .index("by_user", ["userId"])
    .index("by_user_account", ["userId", "accountId"])
    .index("by_user_date", ["userId", "entryDate"])
    .index("by_user_ticket", ["userId", "mt5Ticket"]),

  goals: defineTable({
    userId: v.id("users"),
    title: v.string(),
    category: v.string(),
    targetValue: v.number(),
    currentValue: v.number(),
    unit: v.string(),
    period: v.string(),
    deadline: v.optional(v.string()),
    completed: v.boolean(),
    notes: v.optional(v.string()),
    isHardRiskLimit: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_completed", ["userId", "completed"]),

  phases: defineTable({
    userId: v.id("users"),
    accountId: v.optional(v.id("accounts")),
    name: v.string(),
    startBalance: v.number(),
    targetBalance: v.number(),
    startDate: v.string(), // "YYYY-MM-DD" — trades on/after this date count toward the phase
    dailyProfitTarget: v.optional(v.number()),
    maxDailyLoss: v.optional(v.number()),
    maxTotalLoss: v.optional(v.number()),
    status: v.string(), // "active" | "passed" | "failed" (passed/failed are locked)
    archived: v.optional(v.boolean()),
    startedAt: v.optional(v.number()), // ms when the phase became active; only later trades count for daily rules
    lockedBalance: v.optional(v.number()),
    lockedAt: v.optional(v.number()),
    failReason: v.optional(v.string()),
    firm: v.optional(v.string()),
    stage: v.optional(v.string()), // "Phase 1" | "Phase 2" | "Funded / Payout"
    stageOrder: v.optional(v.number()),
    prevPhaseId: v.optional(v.id("phases")),
    drawdownType: v.optional(v.string()), // "static" (default) | "trailing"
    trailingLock: v.optional(v.boolean()), // trailing floor stops rising once it reaches the start balance
    instant: v.optional(v.boolean()), // instant-funded account: no evaluation phases
    peakBalance: v.optional(v.number()), // highest balance since the phase began (drives the trailing floor)
    images: v.optional(
      v.array(v.object({ storageId: v.id("_storage"), caption: v.optional(v.string()) }))
    ),
  }).index("by_user", ["userId"]),

  coachMessages: defineTable({
    userId: v.id("users"),
    accountId: v.optional(v.id("accounts")),
    role: v.string(), // "user" | "assistant"
    content: v.string(),
  }).index("by_user", ["userId"]).index("by_user_account", ["userId", "accountId"]),

  competitions: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    startDate: v.string(), // "YYYY-MM-DD", inclusive
    endDate: v.string(), // "YYYY-MM-DD", inclusive
    // Optional end goal: first participant to reach this value wins automatically.
    targetMetric: v.optional(v.union(v.literal("netPnL"), v.literal("returnPercentage"))),
    targetValue: v.optional(v.number()),
  }).index("by_start_date", ["startDate"]),

  competitionParticipants: defineTable({
    competitionId: v.id("competitions"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_competition", ["competitionId"])
    .index("by_user", ["userId"])
    .index("by_competition_user", ["competitionId", "userId"]),

  marketingPosts: defineTable({
    platform: v.string(), // facebook | instagram | whatsapp | linkedin | x
    caption: v.string(),
    image: v.string(), // e.g. "01" … "12", or "" for text only
    status: v.string(), // draft | approved | posted
    scheduledFor: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  // Posting-service key for the marketing agent. Never returned to the browser (no query exposes it).
  socialConnections: defineTable({
    platform: v.string(),
    accessToken: v.string(),
    expiresAt: v.number(),
    memberUrn: v.string(),
    name: v.string(),
    connectedAt: v.number(),
  }).index("by_platform", ["platform"]),
});
