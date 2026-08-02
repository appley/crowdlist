import type { Doc } from "./_generated/dataModel";

export type Crowd = "easy" | "comfortable" | "busy" | "packed";
export type Energy = "low" | "medium" | "high";
export type Trend = "rising" | "steady" | "falling";

const CROWD_VALUE: Record<Crowd, number> = {
  easy: 1,
  comfortable: 2,
  busy: 3,
  packed: 4,
};

const ENERGY_VALUE: Record<Energy, number> = { low: 1, medium: 2, high: 3 };

function crowdFromValue(value: number): Crowd {
  if (value < 1.5) return "easy";
  if (value < 2.5) return "comfortable";
  if (value < 3.5) return "busy";
  return "packed";
}

function energyFromValue(value: number): Energy {
  if (value < 1.5) return "low";
  if (value < 2.5) return "medium";
  return "high";
}

export function aggregateReports(reports: Doc<"reports">[]) {
  const now = Date.now();
  const weighted = reports.map((report) => {
    const ageMinutes = Math.max(0, (now - report.createdAt) / 60_000);
    return {
      crowd: report.parsedCrowd ?? report.crowd,
      energy: report.parsedEnergy ?? report.energy,
      trend: report.parsedTrend ?? report.trend,
      weight: Math.max(0.2, Math.exp(-ageMinutes / 25)),
      summary: report.summary,
      createdAt: report.createdAt,
    };
  });
  const weight = weighted.reduce((total, report) => total + report.weight, 0) || 1;
  const trendScore = weighted.reduce(
    (total, report) => total + ({ falling: -1, steady: 0, rising: 1 }[report.trend] * report.weight),
    0,
  ) / weight;

  return {
    crowd: crowdFromValue(
      weighted.reduce((total, report) => total + CROWD_VALUE[report.crowd] * report.weight, 0) /
        weight,
    ),
    energy: energyFromValue(
      weighted.reduce((total, report) => total + ENERGY_VALUE[report.energy] * report.weight, 0) /
        weight,
    ),
    trend: (trendScore > 0.2 ? "rising" : trendScore < -0.2 ? "falling" : "steady") as Trend,
    summary: weighted.find((report) => report.summary)?.summary,
    reportCount: reports.length,
    updatedAt: Math.max(...reports.map((report) => report.createdAt)),
  };
}
