import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker,
  StyleSpecification,
} from "maplibre-gl";
import { FESTIVAL, MAP_COORDINATES, STAGES } from "../../data/festival";
import { CROWD_VALUE } from "../../lib/pulse";
import type { Stage, StagePulse } from "../../types";

maplibregl.setWorkerUrl(mapLibreWorkerUrl);

interface CrowdMapProps {
  pulses: StagePulse[];
  selectedStageId: string;
  onSelectStage: (stageId: string) => void;
  userLocation: [number, number] | null;
  locationLabel: string | null;
  recenterToken: number;
}

function activityGeoJson(pulses: StagePulse[]) {
  const pulseByStage = new Map(pulses.map((pulse) => [pulse.stageId, pulse]));
  return {
    type: "FeatureCollection" as const,
    features: STAGES.map((stage) => {
      const pulse = pulseByStage.get(stage.id);
      return {
        type: "Feature" as const,
        properties: {
          stageId: stage.id,
          weight: pulse ? CROWD_VALUE[pulse.crowd] : 1,
          crowd: pulse?.crowd ?? "easy",
        },
        geometry: {
          type: "Point" as const,
          coordinates: stage.coordinates,
        },
      };
    }),
  };
}

function fitFestival(map: MapLibreMap) {
  const width = Math.max(390, map.getContainer().clientWidth);
  const responsiveZoom = Math.min(14.25, 12.95 + Math.log2(width / 390));
  map.easeTo({
    center: [-122.484, 37.7678],
    zoom: responsiveZoom,
    duration: 700,
  });
}

function makeStageMarker(
  stage: Stage,
  onSelectStage: (stageId: string) => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "stage-marker";
  button.dataset.stageId = stage.id;
  button.setAttribute("aria-label", `Open ${stage.name} live activity`);
  button.style.setProperty("--stage-accent", stage.accent);
  button.innerHTML = `<span class="stage-marker__pulse" aria-hidden="true"></span><span class="stage-marker__dot" aria-hidden="true"></span><span class="stage-marker__label">${stage.name}</span>`;
  button.addEventListener("click", () => onSelectStage(stage.id));
  return button;
}

export function CrowdMap({
  pulses,
  selectedStageId,
  onSelectStage,
  userLocation,
  locationLabel,
  recenterToken,
}: CrowdMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const stageMarkersRef = useRef<Map<string, Marker>>(new Map());
  const locationMarkerRef = useRef<Marker | null>(null);
  const onSelectStageRef = useRef(onSelectStage);

  useEffect(() => {
    onSelectStageRef.current = onSelectStage;
  }, [onSelectStage]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const style: StyleSpecification = {
      version: 8,
      sources: {
        "patron-map": {
          type: "image",
          url: FESTIVAL.map.image,
          coordinates: MAP_COORDINATES as [
            [number, number],
            [number, number],
            [number, number],
            [number, number],
          ],
        },
        activity: {
          type: "geojson",
          data: activityGeoJson(pulses),
        },
      },
      layers: [
        {
          id: "park-background",
          type: "background",
          paint: { "background-color": "#b7d650" },
        },
        {
          id: "patron-map",
          type: "raster",
          source: "patron-map",
          paint: { "raster-opacity": 1, "raster-fade-duration": 0 },
        },
        {
          id: "activity-heat",
          type: "heatmap",
          source: "activity",
          maxzoom: 18,
          paint: {
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "weight"],
              1,
              0.25,
              4,
              1,
            ],
            "heatmap-intensity": 0.85,
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 13, 26, 16, 68],
            "heatmap-opacity": 0.56,
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

    const wideLayout = containerRef.current.clientWidth >= 780;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [-122.4936, wideLayout ? 37.773 : 37.7678],
      zoom: 14.3,
      minZoom: 13.1,
      maxZoom: 17.2,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });

    mapRef.current = map;
    map.once("load", () => {
      for (const stage of STAGES) {
        const element = makeStageMarker(stage, (stageId) =>
          onSelectStageRef.current(stageId),
        );
        const pulse = pulses.find((candidate) => candidate.stageId === stage.id);
        element.dataset.crowd = pulse?.crowd ?? "easy";
        element.dataset.energy = pulse?.energy ?? "low";
        element.classList.toggle("is-selected", stage.id === selectedStageId);
        const marker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat(stage.coordinates)
          .addTo(map);
        stageMarkersRef.current.set(stage.id, marker);
      }
    });

    return () => {
      stageMarkersRef.current.clear();
      locationMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // The map owns its initial data. Later changes go through setData below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource("activity") as GeoJSONSource | undefined;
    source?.setData(activityGeoJson(pulses));

    const pulseByStage = new Map(pulses.map((pulse) => [pulse.stageId, pulse]));
    for (const [stageId, marker] of stageMarkersRef.current) {
      const element = marker.getElement();
      const pulse = pulseByStage.get(stageId);
      element.dataset.crowd = pulse?.crowd ?? "easy";
      element.dataset.energy = pulse?.energy ?? "low";
      element.classList.toggle("is-selected", stageId === selectedStageId);
      const stage = STAGES.find((candidate) => candidate.id === stageId);
      if (stage && pulse) {
        element.setAttribute(
          "aria-label",
          `${stage.name}: ${pulse.crowd}, ${pulse.energy} energy. Open live activity.`,
        );
      }
    }
  }, [pulses, selectedStageId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) {
      locationMarkerRef.current?.remove();
      locationMarkerRef.current = null;
      return;
    }

    const shouldRecenter = map.isStyleLoaded();
    const element = document.createElement("div");
    element.className = "location-marker";
    element.innerHTML = `<span class="location-marker__halo" aria-hidden="true"></span><span class="location-marker__dot" aria-hidden="true"></span><span class="location-marker__label">${locationLabel ?? "You are here"}</span>`;
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", locationLabel ?? "You are here");

    locationMarkerRef.current?.remove();
    locationMarkerRef.current = new maplibregl.Marker({ element, anchor: "center" })
      .setLngLat(userLocation)
      .addTo(map);
    if (shouldRecenter && locationLabel !== "Demo location") {
      map.easeTo({ center: userLocation, duration: 700 });
    }
  }, [userLocation, locationLabel]);

  useEffect(() => {
    if (mapRef.current && recenterToken > 0) fitFestival(mapRef.current);
  }, [recenterToken]);

  return (
    <div
      ref={containerRef}
      className="crowd-map"
      role="application"
      aria-label="Interactive Outside Lands festival activity map"
      data-testid="crowd-map"
    />
  );
}
