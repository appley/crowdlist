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

export function cleanSongProposal(input: SongProposalInput): SongProposalInput | null {
  const stageId = input.stageId.trim();
  const title = input.title.trim().replace(/\s+/g, " ");
  const artist = input.artist.trim().replace(/\s+/g, " ");
  if (!stageId || !title || !artist || title.length > 160 || artist.length > 160) return null;
  return { ...input, stageId, title, artist };
}

export function songProposalKey(input: Pick<SongProposalInput, "stageId" | "title" | "artist">) {
  return `${input.stageId}\u0000${input.title.toLocaleLowerCase()}\u0000${input.artist.toLocaleLowerCase()}`;
}
