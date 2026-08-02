import type { DensityBucket, FestivalDay } from "./schema";
import { stableId } from "../sim/rng";

export interface PingEvent { h3: string; t: number; clientId: string; seq: number }

export function* pingEvents(day: FestivalDay): Generator<PingEvent> {
  let client = 0;
  for (const bucket of day.density) {
    for (let seq = 1; seq <= bucket.n; seq += 1) {
      yield { h3: bucket.h3, t: bucket.t, clientId: `sim-${stableId(client++)}`, seq };
    }
  }
}

export function encodeNdjson(day: FestivalDay, limit = Number.POSITIVE_INFINITY): string {
  const lines: string[] = [];
  for (const event of pingEvents(day)) {
    lines.push(JSON.stringify(event));
    if (lines.length >= limit) break;
  }
  return `${lines.join("\n")}\n`;
}

export function replayBatches(day: FestivalDay, compressedDurationMs: number): { delayMs: number; buckets: DensityBucket[] }[] {
  const byTime = new Map<number, DensityBucket[]>();
  for (const bucket of day.density) byTime.set(bucket.t, [...(byTime.get(bucket.t) || []), bucket]);
  const times = [...byTime.keys()].sort((a, b) => a - b);
  const span = Math.max(1, (times.at(-1) || 0) - (times[0] || 0));
  return times.map((time) => ({ delayMs: Math.round((time - times[0]) / span * compressedDurationMs), buckets: byTime.get(time)! }));
}

export async function replayToEndpoint(
  day: FestivalDay,
  endpoint: string,
  compressedDurationMs = 300_000,
  transport: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<void> {
  const batches = replayBatches(day, compressedDurationMs);
  let elapsed = 0;
  for (const batch of batches) {
    await wait(Math.max(0, batch.delayMs - elapsed));
    elapsed = batch.delayMs;
    const body = batch.buckets.flatMap((bucket) => Array.from({ length: bucket.n }, (_, index) => JSON.stringify({ h3: bucket.h3, t: bucket.t, clientId: `sim-${stableId(index)}`, seq: index + 1 }))).join("\n");
    const response = await transport(endpoint, { method: "POST", headers: { "content-type": "application/x-ndjson" }, body: `${body}\n` });
    if (!response.ok) throw new Error(`Replay endpoint returned ${response.status}`);
  }
}

export function downloadJson(day: FestivalDay): void {
  download(new Blob([JSON.stringify(day)], { type: "application/json" }), `crowdsim-${day.meta.seed ?? "measured"}.json`);
}

export function downloadNdjson(day: FestivalDay): void {
  download(new Blob([encodeNdjson(day)], { type: "application/x-ndjson" }), `crowdsim-${day.meta.seed ?? "measured"}.ndjson`);
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}
