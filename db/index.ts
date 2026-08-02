import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { getCrowdListRuntimeEnv } from "../lib/data/runtime-env";

export function getDb() {
  return drizzle(getCrowdListRuntimeEnv().DB, { schema });
}
