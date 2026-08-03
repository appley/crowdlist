import type {
  CrowdListDataSource,
  SongProposalInput,
  SongProposalResult,
  SongRecognitionResult,
  StageOneSnapshot,
} from "./types";

export class HttpCrowdListDataSource implements CrowdListDataSource {
  constructor(private readonly baseUrl: string) {}

  async getStageOneSnapshot(): Promise<StageOneSnapshot> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/stage-one`);
    if (!response.ok) {
      throw new Error(`CrowdList backend returned ${response.status}.`);
    }
    return (await response.json()) as StageOneSnapshot;
  }

  async identifySong(input: {
    stageId: string;
    audioBase64: string;
    mimeType: string;
  }): Promise<SongRecognitionResult> {
    return this.request<SongRecognitionResult>("/api/identify", input);
  }

  async submitSongProposal(input: SongProposalInput): Promise<SongProposalResult> {
    return this.request<SongProposalResult>("/api/songs/propose", input);
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as T & { error?: string; message?: string };
    if (!response.ok) {
      throw new Error(result.error ?? result.message ?? `CrowdList backend returned ${response.status}.`);
    }
    return result;
  }
}

export function createCrowdListDataSource(): CrowdListDataSource {
  const baseUrl = process.env.EXPO_PUBLIC_CROWDLIST_API_URL;
  if (!baseUrl) {
    throw new Error("EXPO_PUBLIC_CROWDLIST_API_URL is not configured.");
  }
  return new HttpCrowdListDataSource(baseUrl);
}
