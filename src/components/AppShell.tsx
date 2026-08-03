import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ACTIVITY_PORTRAIT } from "../data/activity";
import { DEMO_LOCATION, STAGES } from "../data/festival";
import { activityPointsFromFrame, mergeActivityPulses } from "../lib/activity";
import { getAnonymousId } from "../lib/identity";
import { hasWebGl } from "../lib/webgl";
import type { FestivalDataSource, ReportInput } from "../types";
import { CrowdMap } from "./map/CrowdMap";
import { StageList } from "./map/StageList";
import { MapControls } from "./MapControls";
import { MapHeader } from "./MapHeader";
import { ReportComposer } from "./reports/ReportComposer";
import { StagePulseSheet } from "./stage/StagePulseSheet";
import { Toast } from "./Toast";

interface AppShellProps extends FestivalDataSource {}

const FESTIVAL_BOUNDS = {
  west: -122.521,
  east: -122.449,
  south: 37.7635,
  north: 37.7755,
};

function isOnFestivalMap([longitude, latitude]: [number, number]) {
  return longitude >= FESTIVAL_BOUNDS.west && longitude <= FESTIVAL_BOUNDS.east &&
    latitude >= FESTIVAL_BOUNDS.south && latitude <= FESTIVAL_BOUNDS.north;
}

const PRESENCE_GRID_DEGREES = 0.0006;

function coarsePresenceCoordinate(value: number) {
  return Math.round(value / PRESENCE_GRID_DEGREES) * PRESENCE_GRID_DEGREES;
}

export function AppShell({
  pulses,
  presenceCells = [],
  status,
  submitReport,
  submitPresence,
  recognizeSong,
}: AppShellProps) {
  const [selectedStageId, setSelectedStageId] = useState("sutro");
  const [reportOpen, setReportOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [recenterToken, setRecenterToken] = useState(0);
  const [activityFrameIndex, setActivityFrameIndex] = useState(0);
  const [activityPlaying, setActivityPlaying] = useState(true);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "info" } | null>(null);
  const anonId = useMemo(() => getAnonymousId(), []);
  const mapSupported = useMemo(() => {
    const forceList = new URLSearchParams(window.location.search).get("nomap") === "1";
    return !forceList && hasWebGl();
  }, []);

  const selectedStage = STAGES.find((stage) => stage.id === selectedStageId) ?? STAGES[0];
  const activityFrame = ACTIVITY_PORTRAIT.frames[activityFrameIndex] ?? ACTIVITY_PORTRAIT.frames[0];
  const effectivePulses = useMemo(
    () => mergeActivityPulses(pulses, activityFrame),
    [activityFrame, pulses],
  );
  const activityPoints = useMemo(() => [
    ...activityPointsFromFrame(activityFrame),
    ...presenceCells.map((cell) => ({
      coordinates: [cell.longitude, cell.latitude] as [number, number],
      weight: Math.min(1.25, 0.72 + cell.count * 0.13),
      contributors: cell.count,
    })),
  ], [activityFrame, presenceCells]);
  const selectedPulse =
    effectivePulses.find((pulse) => pulse.stageId === selectedStage.id) ?? effectivePulses[0];

  useEffect(() => {
    if (!activityPlaying || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => {
      setActivityFrameIndex((index) => (index + 1) % ACTIVITY_PORTRAIT.frames.length);
    }, ACTIVITY_PORTRAIT.meta.frameDurationMs);
    return () => window.clearInterval(interval);
  }, [activityPlaying]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      setUserLocation(DEMO_LOCATION);
      setLocationLabel("Demo location");
    }
  }, []);

  const useDemoLocation = useCallback(() => {
    setUserLocation(DEMO_LOCATION);
    setLocationLabel("Demo location");
    setLocationDenied(false);
    setToast({ message: "Demo location placed on a festival path.", tone: "info" });
  }, []);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationDenied(true);
      setToast({ message: "Location is unavailable here. Try the demo spot.", tone: "info" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinates: [number, number] = [coords.longitude, coords.latitude];
        if (!isOnFestivalMap(coordinates)) {
          setLocationDenied(true);
          setLocating(false);
          setToast({ message: "You’re outside the live grounds. Try the demo spot.", tone: "info" });
          return;
        }
        setUserLocation(coordinates);
        setLocationLabel("You are here");
        setLocationDenied(false);
        setLocating(false);
        if (submitPresence) {
          void submitPresence({
            anonId,
            longitude: coarsePresenceCoordinate(coords.longitude),
            latitude: coarsePresenceCoordinate(coords.latitude),
          }).then(() => {
            setToast({ message: "Your anonymous coarse signal is live for two minutes.", tone: "success" });
          }).catch(() => {
            setToast({ message: "Location stayed on your phone. The map still works.", tone: "info" });
          });
        }
      },
      () => {
        setLocationDenied(true);
        setLocating(false);
        setToast({ message: "Location stayed private. The rest of CrowdList still works.", tone: "info" });
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 30_000 },
    );
  }, [anonId, submitPresence]);

  const sendReport = useCallback(
    async (input: ReportInput) => {
      await submitReport(input);
      setToast({ message: `${selectedStage.name} just changed on the live map.`, tone: "success" });
    },
    [selectedStage.name, submitReport],
  );

  if (!selectedPulse) {
    return (
      <main className="loading-screen">
        <span className="loading-screen__orb" aria-hidden="true" />
        <strong>Waking up the festival map…</strong>
      </main>
    );
  }

  return (
    <main className={mapSupported ? "app-shell" : "app-shell app-shell--list"}>
      {mapSupported ? (
        <>
          <CrowdMap
            pulses={effectivePulses}
            activityPoints={activityPoints}
            selectedStageId={selectedStage.id}
            onSelectStage={setSelectedStageId}
            userLocation={userLocation}
            locationLabel={locationLabel}
            recenterToken={recenterToken}
          />
          <div className="map-vignette" aria-hidden="true" />
        </>
      ) : (
        <StageList
          pulses={effectivePulses}
          selectedStageId={selectedStage.id}
          onSelectStage={setSelectedStageId}
        />
      )}
      <MapHeader status={status} />
      <button
        className="demo-clock"
        type="button"
        onClick={() => setActivityPlaying((playing) => !playing)}
        aria-label={`${activityPlaying ? "Pause" : "Play"} simulated festival activity`}
      >
        <span>FRI</span>
        <strong>
          {new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Los_Angeles",
          }).format(new Date(activityFrame.at))}
        </strong>
        <span className="demo-clock__control">
          {activityPlaying ? <Pause size={11} aria-hidden="true" /> : <Play size={11} aria-hidden="true" />}
          {activityPlaying ? "LIVE" : "PAUSED"}
        </span>
      </button>
      {mapSupported ? (
        <>
          <MapControls
            onLocate={locate}
            onDemoLocation={useDemoLocation}
            onRecenter={() => setRecenterToken((value) => value + 1)}
            showDemoFallback={locationDenied}
            locating={locating}
          />
          <div className="map-key" aria-label="Crowd comfort key">
            <span><i className="key-dot key-dot--easy" />Easy</span>
            <span><i className="key-dot key-dot--comfortable" />Comfortable</span>
            <span><i className="key-dot key-dot--busy" />Busy</span>
            <span><i className="key-dot key-dot--packed" />Packed</span>
          </div>
        </>
      ) : null}
      <StagePulseSheet
        stage={selectedStage}
        pulse={selectedPulse}
        onReport={() => setReportOpen(true)}
        recognizeSong={recognizeSong}
      />
      {mapSupported ? (
        <div className="map-attribution">
          Park data © OpenStreetMap contributors · Zones follow the official
          2026 patron map · Approximate placement
        </div>
      ) : null}
      {reportOpen ? (
        <ReportComposer
          stage={selectedStage}
          anonId={anonId}
          onClose={() => setReportOpen(false)}
          onSubmit={sendReport}
        />
      ) : null}
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </main>
  );
}
