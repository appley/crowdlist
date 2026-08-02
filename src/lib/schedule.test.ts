import { describe, expect, it } from "vitest";
import { formatClock, scheduleAt } from "./schedule";

describe("festival schedule", () => {
  it("uses Pacific time regardless of the viewer timezone", () => {
    const fridayAt650Pacific = new Date("2026-08-08T01:50:00.000Z");

    expect(scheduleAt("lands-end", fridayAt650Pacific)).toEqual({
      now: { name: "Labrinth", start: "18:30", end: "19:40" },
      next: { name: "Charli xcx", start: "20:40", end: "22:00" },
    });
    expect(scheduleAt("sutro", fridayAt650Pacific)).toEqual({
      now: null,
      next: { name: "Turnstile", start: "19:20", end: "20:20" },
    });
  });

  it("formats clock labels without depending on the browser timezone", () => {
    expect(formatClock("00:05")).toBe("12:05 AM");
    expect(formatClock("18:30")).toBe("6:30 PM");
  });
});
