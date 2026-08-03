export type LineupSlot = {
  artist: string;
  startTs: string;
  endTs: string;
};

export type Stage = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lineup: LineupSlot[];
};

export type Presence = {
  userId: string;
  stageId: string;
  lat: number;
  lng: number;
  updatedAt: string;
};

export type NowPlaying = {
  stageId: string;
  title: string;
  artist: string;
  source: "audd" | "human" | "hybrid";
  confidence: number;
  status: "proposed" | "confirmed";
};

export type Proposal = {
  id: string;
  stageId: string;
  title: string;
  artist: string;
  source: "audd" | "human";
  votes: number;
  createdAt: string;
};

export type SetlistItem = {
  id: string;
  stageId: string;
  title: string;
  artist: string;
  playedAt: string;
};

export type StageOneSnapshot = {
  stages: Stage[];
  presence: Presence[];
};

export type SimulatedPresenceInput = Omit<Presence, "updatedAt"> & {
  updatedAt: string;
};

export interface CrowdListRepository {
  getStageOneSnapshot(): Promise<StageOneSnapshot>;
  resetStageOne(stages: Stage[]): Promise<void>;
  replacePresence(presence: SimulatedPresenceInput[]): Promise<void>;
  submitSongProposal(
    input: import("./song-proposals").SongProposalInput,
    threshold: number,
  ): Promise<import("./song-proposals").SongProposalResult>;
}
