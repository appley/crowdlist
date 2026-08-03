/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as acrcloud from "../acrcloud.js";
import type * as bootstrap from "../bootstrap.js";
import type * as demo from "../demo.js";
import type * as fixtures from "../fixtures.js";
import type * as jambase from "../jambase.js";
import type * as openai from "../openai.js";
import type * as presence from "../presence.js";
import type * as pulseModel from "../pulseModel.js";
import type * as pulses from "../pulses.js";
import type * as reports from "../reports.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  acrcloud: typeof acrcloud;
  bootstrap: typeof bootstrap;
  demo: typeof demo;
  fixtures: typeof fixtures;
  jambase: typeof jambase;
  openai: typeof openai;
  presence: typeof presence;
  pulseModel: typeof pulseModel;
  pulses: typeof pulses;
  reports: typeof reports;
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
