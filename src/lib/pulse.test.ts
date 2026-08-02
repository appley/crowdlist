import { describe, expect, it, vi } from "vitest";
import { applyFixtureReport, crowdFromValue, energyFromValue } from "./pulse";

describe("pulse aggregation", () => {
  it("maps weighted values to the public labels", () => {
    expect(crowdFromValue(1.49)).toBe("easy");
    expect(crowdFromValue(3.7)).toBe("packed");
    expect(energyFromValue(1.6)).toBe("medium");
    expect(energyFromValue(2.7)).toBe("high");
  });

  it("applies a fixture report immediately and marks it fresh", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_785_708_000_000);
    const updated = applyFixtureReport(
      {
        stageId: "sutro",
        crowd: "comfortable",
        energy: "medium",
        trend: "steady",
        reportCount: 4,
        freshnessMinutes: 6,
        source: "seeded-demo",
      },
      "packed",
      "high",
      "rising",
    );

    expect(updated).toMatchObject({
      stageId: "sutro",
      crowd: "busy",
      energy: "medium",
      trend: "rising",
      reportCount: 5,
      freshnessMinutes: 0,
      source: "mixed",
      updatedAt: 1_785_708_000_000,
    });
    vi.restoreAllMocks();
  });
});
