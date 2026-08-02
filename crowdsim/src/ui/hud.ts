import type { FestivalDay } from "../data/schema";
import { currentSet } from "../sim/schedule";
import { formatTime } from "./inspector";

export function createHud(day: FestivalDay): { element: HTMLElement; update(time: number): void } {
  const element = document.createElement("section");
  element.className = "hud";
  element.innerHTML = `<header><div><p class="micro-label">STAGES AT <span data-time></span></p><h2>Now across the park</h2></div><button aria-label="Collapse stage readout">−</button></header><div data-rows></div>`;
  const body = element.querySelector<HTMLElement>("[data-rows]")!;
  element.querySelector("button")!.addEventListener("click", () => element.classList.toggle("collapsed"));
  let dragging = false; let origin = [0, 0]; let start = [0, 0];
  element.querySelector("header")!.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement).closest("button")) return;
    dragging = true; origin = [event.clientX, event.clientY]; const rect = element.getBoundingClientRect(); start = [rect.left, rect.top]; element.setPointerCapture(event.pointerId);
  });
  element.addEventListener("pointermove", (event) => { if (!dragging) return; element.style.left = `${start[0] + event.clientX - origin[0]}px`; element.style.top = `${start[1] + event.clientY - origin[1]}px`; element.style.right = "auto"; });
  element.addEventListener("pointerup", () => { dragging = false; });
  return {
    element,
    update(time) {
      element.querySelector<HTMLElement>("[data-time]")!.textContent = formatTime(time);
      body.innerHTML = day.site.stages.map((stage) => `<div class="hud-row"><span>${stage.name}</span><strong>${currentSet(day.sets, stage.id, time)?.artistName || "Between sets"}</strong></div>`).join("");
    },
  };
}
