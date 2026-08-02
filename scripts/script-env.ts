import { loadEnvFile } from "node:process";

export function loadLocalEnv() {
  try {
    loadEnvFile(".env");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
}
