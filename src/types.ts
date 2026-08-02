export type CrowdLevel = "easy" | "comfortable" | "busy" | "packed";
export type EnergyLevel = "low" | "medium" | "high";
export type Trend = "rising" | "steady" | "falling";

export interface Stage {
  id: string;
  name: string;
  zone: string;
  accent: string;
  coordinates: [number, number];
}

export interface StagePulse {
  stageId: string;
  crowd: CrowdLevel;
  energy: EnergyLevel;
  trend: Trend;
  reportCount: number;
  freshnessMinutes: number;
  updatedAt?: number;
  source?: "seeded-demo" | "community" | "mixed";
  summary?: string;
}

export interface Performance {
  name: string;
  start: string;
  end: string;
}

export interface StageSchedule {
  now: Performance | null;
  next: Performance | null;
}

export interface ReportInput {
  stageId: string;
  crowd: CrowdLevel;
  energy: EnergyLevel;
  trend: Trend;
  text?: string;
  anonId: string;
}

export interface SongMatch {
  title: string;
  artists: string[];
  album?: string;
  score?: number;
  acrid: string;
  isrc?: string;
  spotifyId?: string;
  youtubeId?: string;
}

export type SongRecognitionResponse =
  | { status: "match"; match: SongMatch }
  | { status: "no_match" }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

export interface SongRecognitionInput {
  stageId: string;
  audioBase64: string;
  mimeType: string;
}

export interface FestivalDataSource {
  pulses: StagePulse[];
  status: "connecting" | "live" | "fixture" | "degraded";
  submitReport: (input: ReportInput) => Promise<void>;
  recognizeSong?: (input: SongRecognitionInput) => Promise<SongRecognitionResponse>;
}
