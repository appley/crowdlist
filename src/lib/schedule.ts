import { DEMO_NOW, FESTIVAL, performancesFor } from "../data/festival";
import type { Performance, StageSchedule } from "../types";

function minutesSinceMidnight(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function scheduleAt(
  stageId: string,
  now: Date = DEMO_NOW,
): StageSchedule {
  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: FESTIVAL.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hours = Number(timeParts.find((part) => part.type === "hour")?.value ?? 0);
  const minutes = Number(timeParts.find((part) => part.type === "minute")?.value ?? 0);
  const clock = hours * 60 + minutes;
  const performances = performancesFor(stageId);
  let current: Performance | null = null;
  let next: Performance | null = null;

  for (const performance of performances) {
    const start = minutesSinceMidnight(performance.start);
    const end = minutesSinceMidnight(performance.end);
    if (start <= clock && clock < end) {
      current = performance;
      continue;
    }
    if (start > clock && !next) {
      next = performance;
    }
  }

  return { now: current, next };
}

export function formatClock(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}
