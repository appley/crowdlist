import { cellToLatLng } from "h3-js";
import type { FestivalDay, Stage } from "../data/schema";
import type { RenderBucket } from "../render/layers/densityBlanket";
import { currentSet } from "../sim/schedule";

export interface Inspector {
  element: HTMLElement;
  showBucket(bucket: RenderBucket, time: number): void;
  showStage(stage: Stage, time: number, day: FestivalDay): void;
}

export function createInspector(): Inspector {
  const element = document.createElement("aside");
  element.className = "inspector";
  element.innerHTML = `<p class="micro-label">INSPECTOR</p><h2>Select a hex or stage</h2><p class="inspector-empty">Every encoded value is available here. Color is never the only explanation.</p>`;
  return {
    element,
    showBucket(bucket, time) {
      const [lat, lng] = cellToLatLng(bucket.h3);
      element.innerHTML = `<p class="micro-label">H3 CELL · ${bucket.h3}</p><h2>${Math.round(bucket.interpolatedN).toLocaleString()} contributors</h2><dl><div><dt>Confidence</dt><dd>${Math.round(bucket.interpolatedConfidence * 100)}%</dd></div><div><dt>Time</dt><dd>${formatTime(time)}</dd></div><div><dt>Center</dt><dd>${lat.toFixed(5)}, ${lng.toFixed(5)}</dd></div><div><dt>Privacy floor</dt><dd>Passed · n ≥ 5</dd></div></dl>`;
    },
    showStage(stage, time, day) {
      const set = currentSet(day.sets, stage.id, time);
      const nearby = day.density.filter((bucket) => bucket.t === Math.floor(time / 60_000) * 60_000).reduce((sum, bucket) => sum + bucket.n, 0);
      element.innerHTML = `<p class="micro-label">STAGE · AUTHORED GEOMETRY</p><h2>${stage.name}</h2><dl><div><dt>Current set</dt><dd>${set?.artistName || "Between sets"}</dd></div><div><dt>Time</dt><dd>${formatTime(time)}</dd></div><div><dt>Capacity hint</dt><dd>${stage.capacityHint.toLocaleString()}</dd></div><div><dt>Festival contributors</dt><dd>${nearby.toLocaleString()}</dd></div></dl>`;
    },
  };
}

export function formatTime(time: number): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).format(time);
}
