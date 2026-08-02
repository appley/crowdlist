import type { FestivalDay, FestivalEvent } from "../data/schema";
import { formatTime } from "./inspector";

export interface Timeline {
  element: HTMLElement;
  update(time: number, playing: boolean, speed: number): void;
}

export function createTimeline(day: FestivalDay, onTime: (time: number) => void, onToggle: () => void, onSpeed: (speed: number) => void, onEvent: (event: FestivalEvent) => void): Timeline {
  const start = Date.parse("2026-08-02T12:00:00-07:00"); const end = Date.parse("2026-08-02T22:00:00-07:00");
  const element = document.createElement("section"); element.className = "timeline";
  element.innerHTML = `<div class="transport"><button data-play aria-label="Play simulation">▶</button><strong data-clock></strong><label>Speed<select data-speed>${[0.5,1,5,15,30,60].map((value) => `<option value="${value}">${value}×</option>`).join("")}</select></label></div><div class="track-wrap"><input data-range type="range" min="${start}" max="${end}" step="1000" value="${start}" aria-label="Festival time"/><div class="event-track"></div><div class="sets-line" data-sets></div></div>`;
  const range = element.querySelector<HTMLInputElement>("[data-range]")!;
  range.addEventListener("input", () => onTime(Number(range.value)));
  element.querySelector("[data-play]")!.addEventListener("click", onToggle);
  element.querySelector<HTMLSelectElement>("[data-speed]")!.addEventListener("change", (event) => onSpeed(Number((event.target as HTMLSelectElement).value)));
  const track = element.querySelector<HTMLElement>(".event-track")!;
  day.events.forEach((event) => {
    const tick = document.createElement("button"); tick.className = `event-tick ${event.kind}`;
    tick.style.left = `${(event.t - start) / (end - start) * 100}%`; tick.title = `${formatTime(event.t)} · ${event.label}`;
    tick.setAttribute("aria-label", tick.title); tick.addEventListener("click", () => onEvent(event)); track.append(tick);
  });
  return {
    element,
    update(time, playing, speed) {
      range.value = String(time); element.querySelector<HTMLElement>("[data-clock]")!.textContent = formatTime(time);
      const playButton = element.querySelector<HTMLElement>("[data-play]")!;
      playButton.textContent = playing ? "Ⅱ" : "▶";
      playButton.setAttribute("aria-label", playing ? "Pause simulation" : "Play simulation");
      element.querySelector<HTMLSelectElement>("[data-speed]")!.value = String(speed);
      element.querySelector<HTMLElement>("[data-sets]")!.textContent = `${day.sets.filter((set) => set.startsAt <= time && set.endsAt > time).length} stages playing · drag to scrub · space play/pause · ← → step · [ ] speed`;
    },
  };
}
