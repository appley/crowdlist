import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { STAGES } from "../../data/festival";
import { GROUNDS_BOUNDS, ZONE_LABELS } from "../../data/zones";
import { CROWD_VALUE } from "../../lib/pulse";
import { createStyle } from "../../lib/mapStyle";
import type { ActivityPoint, Stage, StagePulse } from "../../types";

maplibregl.setWorkerUrl(mapLibreWorkerUrl);

interface CrowdMapProps {
  pulses: StagePulse[];
  activityPoints: ActivityPoint[];
  selectedStageId: string;
  onSelectStage: (stageId: string) => void;
  userLocation: [number, number] | null;
  locationLabel: string | null;
  recenterToken: number;
}

function activityGeoJson(pulses: StagePulse[], activityPoints: ActivityPoint[]) {
  const pulseByStage = new Map(pulses.map((pulse) => [pulse.stageId, pulse]));
  return {
    type: "FeatureCollection" as const,
    features: [
      ...activityPoints.map((point, index) => ({
        type: "Feature" as const,
        id: `activity-${index}`,
        properties: {
          kind: "activity-cell",
          weight: point.weight,
          contributors: point.contributors,
        },
        geometry: {
          type: "Point" as const,
          coordinates: point.coordinates,
        },
      })),
      ...STAGES.map((stage) => {
        const pulse = pulseByStage.get(stage.id);
        return {
          type: "Feature" as const,
          properties: {
            kind: "stage",
            stageId: stage.id,
            weight: 0.42 + (pulse ? CROWD_VALUE[pulse.crowd] : 1) * 0.2,
            crowd: pulse?.crowd ?? "easy",
          },
          geometry: {
            type: "Point" as const,
            coordinates: stage.coordinates,
          },
        };
      }),
    ],
  };
}

// The sheet covers the lower half on a phone, so the grounds are framed into
// the space that stays visible above it.
function groundsPadding(container: HTMLElement) {
  const { clientHeight, clientWidth } = container;
  return {
    top: 96,
    right: 28,
    bottom: clientWidth >= 780 ? 90 : Math.min(360, clientHeight * 0.46),
    left: 28,
  };
}

function fitFestival(map: MapLibreMap, duration = 700) {
  map.fitBounds(GROUNDS_BOUNDS, {
    padding: groundsPadding(map.getContainer()),
    duration,
    maxZoom: 16,
  });
}


function makeZoneLabel(name: string, ink: string, angle: number): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "zone-label";
  element.style.setProperty("--zone-ink", ink);
  element.style.setProperty("--zone-angle", `${angle}deg`);
  element.textContent = name;
  element.setAttribute("aria-hidden", "true");
  return element;
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
  activityPoints,
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

    const style = createStyle(activityGeoJson(pulses, activityPoints));

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      bounds: GROUNDS_BOUNDS,
      fitBoundsOptions: { padding: groundsPadding(containerRef.current), maxZoom: 16 },
      minZoom: 12.8,
      maxZoom: 17.6,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });

    mapRef.current = map;
    if (import.meta.env.DEV) {
      (window as unknown as { __crowdMap?: MapLibreMap }).__crowdMap = map;
      map.on("error", (event) => console.error("[CrowdList map]", event.error?.message));
    }
    map.once("load", () => {
      for (const zone of ZONE_LABELS) {
        new maplibregl.Marker({
          element: makeZoneLabel(zone.name, zone.ink, zone.angle),
          anchor: "center",
        })
          .setLngLat(zone.center)
          .addTo(map);
      }

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
    source?.setData(activityGeoJson(pulses, activityPoints));

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
  }, [activityPoints, pulses, selectedStageId]);

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
