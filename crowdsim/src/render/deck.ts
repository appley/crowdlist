import { Deck, MapView } from "@deck.gl/core";
import { PathLayer } from "@deck.gl/layers";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FestivalDay, Stage } from "../data/schema";
import type { RenderBucket } from "./layers/densityBlanket";
import { densityBlanket } from "./layers/densityBlanket";
import { eventPins } from "./layers/eventPins";
import { flowRibbons } from "./layers/flowRibbons";
import { stageMarkers } from "./layers/stageMarkers";
type PathDatum = { path: [number, number][]; widthM: number };
let pathCache: { siteId: string; data: PathDatum[] } | null = null;

export interface RenderState {
  time: number; selectedH3: string | null; selectedStage: string | null; debugGraph: boolean;
  onBucket: (bucket: RenderBucket) => void; onStage: (stage: Stage) => void;
}

function mapViewState(map: MapLibreMap) {
  const center = map.getCenter();
  return { longitude: center.lng, latitude: center.lat, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
}

export function attachDeck(map: MapLibreMap): Deck<MapView> {
  let syncing = false;
  const overlay = new Deck({
    parent: document.querySelector<HTMLDivElement>("#deck")!, views: new MapView({ repeat: false, clearColor: false }), controller: true,
    style: { background: "transparent" },
    viewState: mapViewState(map), layers: [],
    onViewStateChange: ({ viewState }) => {
      syncing = true;
      map.jumpTo({ center: [viewState.longitude, viewState.latitude], zoom: viewState.zoom, pitch: viewState.pitch, bearing: viewState.bearing });
      syncing = false;
    },
  });
  map.on("move", () => { if (!syncing) overlay.setProps({ viewState: mapViewState(map) }); });
  return overlay;
}

export function interpolateFrame(day: FestivalDay, time: number): RenderBucket[] {
  const interval = 60_000; const aTime = Math.floor(time / interval) * interval; const bTime = aTime + interval;
  const alpha = (time - aTime) / interval;
  const a = new Map(day.density.filter((bucket) => bucket.t === aTime).map((bucket) => [bucket.h3, bucket]));
  const b = new Map(day.density.filter((bucket) => bucket.t === bTime).map((bucket) => [bucket.h3, bucket]));
  return [...new Set([...a.keys(), ...b.keys()])].sort().map((h3) => {
    const before = a.get(h3); const after = b.get(h3);
    const n = (before?.n || 0) * (1 - alpha) + (after?.n || 0) * alpha;
    const confidence = (before?.confidence || 0) * (1 - alpha) + (after?.confidence || 0) * alpha;
    return { h3, t: aTime, n: Math.round(n), confidence, interpolatedN: n, interpolatedConfidence: confidence };
  }).filter((bucket) => bucket.interpolatedN > 0.2);
}

export function renderLayers(overlay: Deck<MapView>, day: FestivalDay, state: RenderState): void {
  const buckets = interpolateFrame(day, state.time);
  if (!pathCache || pathCache.siteId !== day.site.id) {
    const nodes = new Map(day.site.pathGraph.nodes.map((node) => [node.id, node]));
    pathCache = { siteId: day.site.id, data: day.site.pathGraph.edges.flatMap((edge) => {
      const from = nodes.get(edge.from); const to = nodes.get(edge.to);
      return from && to ? [{ path: [[from.lng, from.lat], [to.lng, to.lat]] as [number, number][], widthM: edge.widthM }] : [];
    }) };
  }
  const paths = new PathLayer<PathDatum>({ id: "site-path-graph", data: pathCache.data, getPath: (item) => item.path,
    getColor: state.debugGraph ? [214, 255, 79, 190] : [112, 124, 117, 120],
    getWidth: (item) => state.debugGraph ? Math.max(1.2, item.widthM * 0.5) : Math.max(0.5, item.widthM * 0.22),
    widthUnits: "pixels", widthMinPixels: state.debugGraph ? 1 : 0.45,
    updateTriggers: { getColor: [state.debugGraph], getWidth: [state.debugGraph] },
  });
  overlay.setProps({ layers: [paths, densityBlanket(buckets, state.selectedH3, state.onBucket), flowRibbons(day, state.time), eventPins(day, state.time), ...stageMarkers(day, state.time, state.selectedStage, state.onStage)] });
}
