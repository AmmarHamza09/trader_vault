/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as coach from "../coach.js";
import type * as competitions from "../competitions.js";
import type * as crons from "../crons.js";
import type * as goals from "../goals.js";
import type * as health from "../health.js";
import type * as healthAi from "../healthAi.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as leaderboard from "../leaderboard.js";
import type * as marketing from "../marketing.js";
import type * as marketingAi from "../marketingAi.js";
import type * as mt5 from "../mt5.js";
import type * as phaseLogic from "../phaseLogic.js";
import type * as phases from "../phases.js";
import type * as push from "../push.js";
import type * as pushSend from "../pushSend.js";
import type * as share from "../share.js";
import type * as social from "../social.js";
import type * as trades from "../trades.js";
import type * as tradingview from "../tradingview.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  admin: typeof admin;
  ai: typeof ai;
  auth: typeof auth;
  billing: typeof billing;
  coach: typeof coach;
  competitions: typeof competitions;
  crons: typeof crons;
  goals: typeof goals;
  health: typeof health;
  healthAi: typeof healthAi;
  helpers: typeof helpers;
  http: typeof http;
  leaderboard: typeof leaderboard;
  marketing: typeof marketing;
  marketingAi: typeof marketingAi;
  mt5: typeof mt5;
  phaseLogic: typeof phaseLogic;
  phases: typeof phases;
  push: typeof push;
  pushSend: typeof pushSend;
  share: typeof share;
  social: typeof social;
  trades: typeof trades;
  tradingview: typeof tradingview;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
