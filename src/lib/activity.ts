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
