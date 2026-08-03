import assert from "node:assert/strict";
import test from "node:test";
import { identifySong } from "../lib/data/song-recognition";
import { cleanSongProposal, songProposalKey } from "../lib/data/song-proposals";

test("manual song proposals are cleaned and grouped case-insensitively", () => {
  const proposal = cleanSongProposal({
    stageId: " lands-end ",
    title: "  360   ",
    artist: " Charli   xcx ",
    source: "human",
  });
  assert.deepEqual(proposal, {
    stageId: "lands-end",
    title: "360",
    artist: "Charli xcx",
    source: "human",
  });
  assert.equal(
    songProposalKey(proposal!),
    songProposalKey({ stageId: "lands-end", title: "360", artist: "CHARLI XCX" }),
  );
});

test("recognition fails safely when server credentials are absent", async () => {
  assert.deepEqual(
    await identifySong(
      { stageId: "sutro", audioBase64: "YWJj", mimeType: "audio/mp4" },
      {},
    ),
    {
      status: "unavailable",
      message: "Song recognition is not configured. Enter the song manually instead.",
    },
  );
});
