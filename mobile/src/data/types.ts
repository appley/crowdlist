export type LineupSlot = { artist: string; startTs: string; endTs: string };
export type Stage = { id: string; name: string; lat: number; lng: number; lineup: LineupSlot[] };
export type Presence = { userId: string; stageId: string; lat: number; lng: number; updatedAt: string };
export type StageOneSnapshot = { stages: Stage[]; presence: Presence[] };
export type SongRecognitionResult =
  | { status: "match"; title: string; artist: string; confidence: number | null }
  | { status: "no_match" | "unavailable" | "error"; message: string };
export type SongProposalInput = {
  stageId: string;
  title: string;
  artist: string;
  source: "human" | "acrcloud";
  confidence?: number;
};
export type SongProposalResult = SongProposalInput & {
  votes: number;
  threshold: number;
  status: "proposed" | "confirmed";
};

export interface CrowdListDataSource {
  getStageOneSnapshot(): Promise<StageOneSnapshot>;
  identifySong(input: {
    stageId: string;
    audioBase64: string;
    mimeType: string;
  }): Promise<SongRecognitionResult>;
  submitSongProposal(input: SongProposalInput): Promise<SongProposalResult>;
}
