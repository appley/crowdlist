import { getCrowdListRuntimeEnv } from "./runtime-env";

export function isAdminRequest(request: Request): boolean {
  const configuredToken = getCrowdListRuntimeEnv().CROWDLIST_ADMIN_TOKEN;
  const suppliedToken = request.headers.get("x-crowdlist-admin-token");
  return Boolean(configuredToken && suppliedToken && suppliedToken === configuredToken);
}
