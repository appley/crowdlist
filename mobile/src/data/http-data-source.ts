import type { CrowdListDataSource, StageOneSnapshot } from "./types";

export class HttpCrowdListDataSource implements CrowdListDataSource {
  constructor(private readonly baseUrl: string) {}

  async getStageOneSnapshot(): Promise<StageOneSnapshot> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/stage-one`);
    if (!response.ok) {
      throw new Error(`CrowdList backend returned ${response.status}.`);
    }
    return (await response.json()) as StageOneSnapshot;
  }
}

export function createCrowdListDataSource(): CrowdListDataSource {
  const baseUrl = process.env.EXPO_PUBLIC_CROWDLIST_API_URL;
  if (!baseUrl) {
    throw new Error("EXPO_PUBLIC_CROWDLIST_API_URL is not configured.");
  }
  return new HttpCrowdListDataSource(baseUrl);
}
