import type { ActivityFrame, ActivityPoint, StagePulse } from "../types";

export function mergeActivityPulses(
  pulses: StagePulse[],
  frame: ActivityFrame,
): StagePulse[] {
  const simulatedByStage = new Map(
    frame.stages.map((stageState) => [stageState.stageId, stageState]),
  );
  return pulses.map((pulse) => {
    // A real community contribution remains authoritative over the simulated
    // presentation floor until the backend ages it out.
    if (pulse.source === "community" || pulse.source === "mixed") return pulse;
    const simulated = simulatedByStage.get(pulse.stageId);
    return simulated
      ? { ...pulse, ...simulated, freshnessMinutes: 0, source: "seeded-demo" }
      : pulse;
  });
}

export function activityPointsFromFrame(frame: ActivityFrame): ActivityPoint[] {
  return frame.points.map(([longitude, latitude, weight, contributors]) => ({
    coordinates: [longitude, latitude],
    weight,
    contributors,
  }));
}

export function interpolateActivityPoints(
  current: ActivityFrame,
  next: ActivityFrame,
  progress: number,
): ActivityPoint[] {
  const amount = Math.min(1, Math.max(0, progress));
  if (current.points.length !== next.points.length) return activityPointsFromFrame(current);
  return current.points.map(([longitude, latitude, weight, contributors], index) => {
    const [nextLongitude, nextLatitude, nextWeight, nextContributors] = next.points[index];
    const interpolatedContributors = Math.round(
      contributors + (nextContributors - contributors) * amount,
    );
    const safeContributors = interpolatedContributors >= 5 ? interpolatedContributors : 0;
    return {
      coordinates: [
        longitude + (nextLongitude - longitude) * amount,
        latitude + (nextLatitude - latitude) * amount,
      ],
      weight: safeContributors ? weight + (nextWeight - weight) * amount : 0,
      contributors: safeContributors,
    };
  });
}
