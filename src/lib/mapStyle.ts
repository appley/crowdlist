import type { StyleSpecification } from "maplibre-gl";
import { BASEMAP_GEOJSON } from "../data/basemap";
import { ZONES_GEOJSON } from "../data/zones";

// The patron map's palette, rebuilt for vector geometry: flat illustrated
// fills, cypress greens, cream paths, and the legend's zone colors.
export const PALETTE = {
  park: "#a8d24f",
  parkDeep: "#9bc744",
  wood: "#79b93f",
  woodEdge: "#5f9c31",
  grass: "#bcdc63",
  field: "#d6e88d",
  water: "#27a8de",
  waterEdge: "#f6f1de",
  roadMajor: "#4b7a2b",
  roadMajorEdge: "#8cbb49",
  roadPark: "#f2ecd6",
  ink: "#10291f",
};

function vectorLayers(): StyleSpecification["layers"] {
  return [
    { id: "background", type: "background", paint: { "background-color": PALETTE.park } },
    {
      id: "park",
      type: "fill",
      source: "basemap",
      filter: ["==", ["get", "kind"], "park"],
      paint: { "fill-color": PALETTE.parkDeep },
    },
    {
      id: "grass",
      type: "fill",
      source: "basemap",
      filter: ["in", ["get", "kind"], ["literal", ["grass", "field"]]],
      paint: { "fill-color": PALETTE.grass, "fill-opacity": 0.85 },
    },
    {
      id: "wood",
      type: "fill",
      source: "basemap",
      filter: ["==", ["get", "kind"], "wood"],
      paint: { "fill-color": PALETTE.wood },
    },
    {
      id: "wood-edge",
      type: "line",
      source: "basemap",
      filter: ["==", ["get", "kind"], "wood"],
      paint: { "line-color": PALETTE.woodEdge, "line-width": 1.4, "line-opacity": 0.7 },
    },
    // Streets get a light casing under a dark olive fill, the way the printed
    // map draws the drives bordering the grounds.
    {
      id: "road-casing",
      type: "line",
      source: "basemap",
      filter: ["==", ["get", "kind"], "road-major"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": PALETTE.roadMajorEdge,
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 5, 17, 22],
      },
    },
    {
      id: "road-major",
      type: "line",
      source: "basemap",
      filter: ["==", ["get", "kind"], "road-major"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": PALETTE.roadMajor,
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 2.6, 17, 14],
      },
    },
    {
      id: "road-park",
      type: "line",
      source: "basemap",
      filter: ["in", ["get", "kind"], ["literal", ["road-park", "road-service"]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": PALETTE.roadPark,
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1.1, 17, 7],
        "line-opacity": 0.9,
      },
    },
    {
      id: "water",
      type: "fill",
      source: "basemap",
      filter: ["==", ["get", "kind"], "water"],
      paint: { "fill-color": PALETTE.water },
    },
    {
      id: "water-edge",
      type: "line",
      source: "basemap",
      filter: ["==", ["get", "kind"], "water"],
      paint: { "line-color": PALETTE.waterEdge, "line-width": 1.6 },
    },
    {
      id: "zone-fill",
      type: "fill",
      source: "zones",
      paint: { "fill-color": ["get", "fill"], "fill-opacity": 0.92 },
    },
    {
      id: "zone-edge",
      type: "line",
      source: "zones",
      paint: { "line-color": PALETTE.ink, "line-width": 1.6, "line-opacity": 0.35 },
    },
  ];
}

export function createStyle(activity: GeoJSON.FeatureCollection): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: { type: "geojson", data: BASEMAP_GEOJSON },
      zones: { type: "geojson", data: ZONES_GEOJSON as GeoJSON.FeatureCollection },
      activity: { type: "geojson", data: activity },
    },
    layers: [
      ...vectorLayers(),
      {
        id: "activity-heat",
        type: "heatmap",
        source: "activity",
        maxzoom: 18,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 1, 0.25, 4, 1],
          "heatmap-intensity": 0.85,
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 13, 26, 16, 68],
          "heatmap-opacity": 0.5,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(24, 195, 180, 0)",
            0.22,
            "rgba(41, 210, 177, 0.26)",
            0.47,
            "rgba(255, 211, 74, 0.43)",
            0.7,
            "rgba(255, 125, 54, 0.55)",
            1,
            "rgba(255, 53, 102, 0.7)",
          ],
        },
      },
    ],
  };
}
