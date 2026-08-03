import { describe, expect, it } from "vitest";
import {
  buildAcrcloudStringToSign,
  parseAcrcloudResponse,
  signAcrcloudRequest,
} from "./acrcloud";

describe("ACRCloud Identify Protocol V1", () => {
  it("builds and signs the canonical request string with HMAC-SHA1", async () => {
    expect(buildAcrcloudStringToSign("test-key", "1700000000")).toBe(
      "POST\n/v1/identify\ntest-key\naudio\n1\n1700000000",
    );
    await expect(
      signAcrcloudRequest("test-secret", "test-key", "1700000000"),
    ).resolves.toBe("iBfU+Pr4tncyMr9T7iihwUaPJGA=");
  });

  it("returns the highest ACRCloud music match metadata", () => {
    expect(parseAcrcloudResponse({
      status: { code: 0, msg: "Success" },
      metadata: {
        music: [{
          title: "Dance Floor",
          acrid: "track-acrid",
          score: 96,
          album: { name: "Live at the Park" },
          artists: [{ name: "The Headliner" }, { name: "A Guest" }],
          external_ids: { isrc: "US-ABC-26-00001" },
          external_metadata: {
            spotify: { track: { id: "spotify-track" } },
            youtube: { vid: "youtube-video" },
          },
        }],
      },
    })).toEqual({
      status: "match",
      match: {
        title: "Dance Floor",
        artists: ["The Headliner", "A Guest"],
        album: "Live at the Park",
        score: 96,
        acrid: "track-acrid",
        isrc: "US-ABC-26-00001",
        spotifyId: "spotify-track",
        youtubeId: "youtube-video",
      },
    });
  });

  it("tolerates wrapped music metadata and reports a no-match response", () => {
    expect(parseAcrcloudResponse({
      status: { code: 0 },
      metadata: {
        music: [{ result: { title: "Wrapped", acrid: "wrapped-acrid", artists: [] } }],
      },
    })).toMatchObject({ status: "match", match: { title: "Wrapped" } });

    expect(parseAcrcloudResponse({ status: { code: 1001 } })).toEqual({ status: "no_match" });
    expect(parseAcrcloudResponse({ status: { code: 2004, msg: "Can't generate fingerprint" } }))
      .toEqual({ status: "no_match" });
  });

  it("does not expose upstream error details", () => {
    expect(parseAcrcloudResponse({ status: { code: 3014, msg: "Invalid signature" } }))
      .toEqual({ status: "error", message: "Song recognition is temporarily unavailable." });
  });
});
