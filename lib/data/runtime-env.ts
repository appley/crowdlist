export type CrowdListRuntimeEnv = {
  DB: D1Database;
  CROWDLIST_ADMIN_TOKEN?: string;
};

declare global {
  // The Worker entry registers request bindings before Vinext dispatches.
  // This avoids importing the Cloudflare-only `cloudflare:workers` scheme in
  // the portable server artifact while keeping the binding server-only.
  var __CROWDLIST_RUNTIME_ENV__: CrowdListRuntimeEnv | undefined;
}

export function registerCrowdListRuntimeEnv(env: CrowdListRuntimeEnv) {
  globalThis.__CROWDLIST_RUNTIME_ENV__ = env;
}

export function getCrowdListRuntimeEnv(): CrowdListRuntimeEnv {
  const runtimeEnv = globalThis.__CROWDLIST_RUNTIME_ENV__;
  if (!runtimeEnv?.DB) {
    throw new Error("CrowdList runtime bindings are unavailable.");
  }
  return runtimeEnv;
}
