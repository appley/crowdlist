import { describe, expect, it } from "vitest";
import { chooseRecordingMimeType } from "./audio";

describe("chooseRecordingMimeType", () => {
  it("prefers compact Opus formats and falls back to browser defaults", () => {
    expect(chooseRecordingMimeType((type) => type === "audio/ogg;codecs=opus"))
      .toBe("audio/ogg;codecs=opus");
    expect(chooseRecordingMimeType(() => false)).toBe("");
  });
});
