import type { Map } from "maplibre-gl";
import type { Stage } from "../data/schema";

export type Viewpoint = "overhead" | "oblique" | "stage";

export function flyToView(map: Map, viewpoint: Viewpoint, stage?: Stage): void {
  if (viewpoint === "overhead") map.flyTo({ center: [-122.492, 37.769], zoom: 14.1, pitch: 0, bearing: 0, duration: 900 });
  else if (viewpoint === "oblique") map.flyTo({ center: [-122.491, 37.769], zoom: 14.55, pitch: 56, bearing: -22, duration: 1050 });
  else if (stage) map.flyTo({ center: [stage.lng, stage.lat], zoom: 16, pitch: 64, bearing: 24, duration: 1100 });
}
