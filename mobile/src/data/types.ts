export type LineupSlot = { artist: string; startTs: string; endTs: string };
export type Stage = { id: string; name: string; lat: number; lng: number; lineup: LineupSlot[] };
export type Presence = { userId: string; stageId: string; lat: number; lng: number; updatedAt: string };
export type StageOneSnapshot = { stages: Stage[]; presence: Presence[] };

export interface CrowdListDataSource {
  getStageOneSnapshot(): Promise<StageOneSnapshot>;
}
