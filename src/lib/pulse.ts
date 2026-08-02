import type { CrowdLevel, EnergyLevel, StagePulse, Trend } from "../types";

export const CROWD_VALUE: Record<CrowdLevel, number> = {
  easy: 1,
  comfortable: 2,
  busy: 3,
  packed: 4,
};

export const ENERGY_VALUE: Record<EnergyLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export const CROWD_LABEL: Record<CrowdLevel, string> = {
  easy: "Easy moving",
  comfortable: "Comfortable",
  busy: "Getting busy",
  packed: "Packed",
};

export const ENERGY_LABEL: Record<EnergyLevel, string> = {
  low: "Laid-back",
  medium: "Buzzing",
  high: "Electric",
};

export const TREND_LABEL: Record<Trend, string> = {
  rising: "Building",
  steady: "Holding steady",
  falling: "Easing up",
};

export function crowdFromValue(value: number): CrowdLevel {
  if (value < 1.5) return "easy";
  if (value < 2.5) return "comfortable";
  if (value < 3.5) return "busy";
  return "packed";
}

export function energyFromValue(value: number): EnergyLevel {
  if (value < 1.5) return "low";
  if (value < 2.5) return "medium";
  return "high";
}

export function applyFixtureReport(
  pulse: StagePulse,
  crowd: CrowdLevel,
  energy: EnergyLevel,
  trend: Trend,
): StagePulse {
  const existingWeight = Math.min(Math.max(pulse.reportCount, 2), 8);
  return {
    ...pulse,
    crowd: crowdFromValue(
      (CROWD_VALUE[pulse.crowd] * existingWeight + CROWD_VALUE[crowd] * 3) /
        (existingWeight + 3),
    ),
    energy: energyFromValue(
      (ENERGY_VALUE[pulse.energy] * existingWeight + ENERGY_VALUE[energy] * 3) /
        (existingWeight + 3),
    ),
    trend,
    reportCount: pulse.reportCount + 1,
    freshnessMinutes: 0,
    updatedAt: Date.now(),
    source: "mixed",
  };
}
