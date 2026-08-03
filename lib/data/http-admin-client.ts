import type {
  SimulatedPresenceInput,
  Stage,
  StageOneSnapshot,
} from "./types";

type HttpAdminClientOptions = {
  baseUrl: string;
  adminToken: string;
};

export class HttpAdminCrowdListRepository {
  constructor(private readonly options: HttpAdminClientOptions) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-crowdlist-admin-token": this.options.adminToken,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  getStageOneSnapshot(): Promise<StageOneSnapshot> {
    return this.request<StageOneSnapshot>("/api/stage-one");
  }

  async resetStageOne(stages: Stage[]): Promise<void> {
    await this.request("/api/admin/seed", {
      method: "POST",
      body: JSON.stringify({ stages }),
    });
  }

  async replacePresence(presence: SimulatedPresenceInput[]): Promise<void> {
    await this.request("/api/admin/simulate", {
      method: "POST",
      body: JSON.stringify({ presence }),
    });
  }

}

export function getHttpAdminRepositoryFromEnv() {
  const baseUrl = process.env.CROWDLIST_API_URL;
  const adminToken = process.env.CROWDLIST_ADMIN_TOKEN;
  if (!baseUrl || !adminToken) {
    throw new Error(
      "Set CROWDLIST_API_URL and CROWDLIST_ADMIN_TOKEN in .env before running data scripts.",
    );
  }
  return new HttpAdminCrowdListRepository({
    baseUrl: baseUrl.replace(/\/$/, ""),
    adminToken,
  });
}
