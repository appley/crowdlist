import { ScatterplotLayer } from "@deck.gl/layers";
import type { FestivalDay, FestivalEvent } from "../../data/schema";
import { eventColors } from "../colors";

type PositionedEvent = FestivalEvent & { position: [number, number] };
export function eventPins(day: FestivalDay, time: number) {
  const data: PositionedEvent[] = day.events.filter((event) => Math.abs(event.t - time) < 4 * 60_000 && event.stageId).flatMap((event) => {
    const stage = day.site.stages.find((item) => item.id === event.stageId); return stage ? [{ ...event, position: [stage.lng, stage.lat] }] : [];
  });
  return new ScatterplotLayer<PositionedEvent>({
    id: "event-pins", data, getPosition: (event) => event.position,
    getRadius: (event) => 30 + (event.magnitude || 0.2) * 45, radiusUnits: "meters",
    getFillColor: (event) => eventColors[event.kind], stroked: true, getLineColor: [240, 244, 238, 180], lineWidthMinPixels: 1,
  });
}
