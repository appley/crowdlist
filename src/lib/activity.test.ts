import { describe, expect, it } from "vitest";
import { ACTIVITY_PORTRAIT } from "../data/activity";
import { INITIAL_PULSES, STAGES } from "../data/festival";
import { activityPointsFromFrame, mergeActivityPulses } from "./activity";

describe("activity portrait", () => {
  it("ships a compact deterministic loop for every official stage", () => {
    expect(ACTIVITY_PORTRAIT.meta.source).toBe("simulated");
    expect(ACTIVITY_PORTRAIT.meta.kAnonymity).toBe(5);
    expect(ACTIVITY_PORTRAIT.frames).toHaveLength(24);

    const expectedStageIds = STAGES.map((stage) => stage.id).sort();
    for (const frame of ACTIVITY_PORTRAIT.frames) {
      expect(frame.stages.map((stage) => stage.stageId).sort()).toEqual(expectedStageIds);
      expect(frame.points.length).toBeGreaterThan(70);
      expect(frame.points.every(([, , weight, contributors]) =>
        weight > 0 && weight <= 1.25 && contributors >= 5
      )).toBe(true);
    }
  });

  it("lets a live community report override the simulated floor", () => {
    const frame = ACTIVITY_PORTRAIT.frames[5];
    const livePulse = {
      ...INITIAL_PULSES[0],
      crowd: "easy" as const,
      source: "mixed" as const,
      freshnessMinutes: 0,
    };
    const merged = mergeActivityPulses([livePulse, INITIAL_PULSES[1]], frame);

    expect(merged[0]).toEqual(livePulse);
    expect(merged[1].source).toBe("seeded-demo");
    expect(merged[1].freshnessMinutes).toBe(0);
    expect(merged[1].crowd).toBe(frame.stages.find((stage) =>
      stage.stageId === INITIAL_PULSES[1].stageId
    )?.crowd);
  });

  it("turns compact tuples into MapLibre-ready points", () => {
    const points = activityPointsFromFrame(ACTIVITY_PORTRAIT.frames[0]);
    expect(points[0].coordinates).toHaveLength(2);
    expect(points.every((point) => point.contributors >= 5)).toBe(true);
  });
});
