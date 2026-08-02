import { TripsLayer } from "@deck.gl/geo-layers";
import type { FestivalDay } from "../../data/schema";

type Trip = { path: [number, number][]; timestamps: number[]; magnitude: number };

export function flowRibbons(day: FestivalDay, time: number) {
  const trips: Trip[] = day.events.filter((event) => event.kind === "mass_migration").flatMap((event, index) => {
    const from = day.site.stages[index % day.site.stages.length];
    const to = day.site.stages[(index * 3 + 2) % day.site.stages.length];
    if (from.id === to.id) return [];
    return [{ path: [[from.lng, from.lat], [from.lng * 0.48 + to.lng * 0.52, from.lat * 0.48 + to.lat * 0.52], [to.lng, to.lat]], timestamps: [event.t, event.t + 4 * 60_000, event.t + 9 * 60_000], magnitude: event.magnitude || 0.3 }];
  });
  return new TripsLayer<Trip>({
    id: "flow-ribbons", data: trips, getPath: (trip) => trip.path, getTimestamps: (trip) => trip.timestamps,
    getColor: [216, 184, 111, 180], getWidth: (trip) => 1.5 + trip.magnitude * 5, widthMinPixels: 1.5,
    currentTime: time, trailLength: 8 * 60_000, capRounded: true, jointRounded: true,
  });
}
