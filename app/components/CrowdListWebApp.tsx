"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Stage, StageOneSnapshot } from "../../lib/data/types";

const CROWD_WINDOW_MS = 2 * 60 * 1000;
const RECORDING_SECONDS = 10;
const MAX_AUDIO_BYTES = 5_000_000;

const MAP_BOUNDS = {
  minLat: 37.768,
  maxLat: 37.772,
  minLng: -122.4925,
  maxLng: -122.4808,
};

type SongRecognitionResult =
  | { status: "match"; title: string; artist: string; confidence: number | null }
  | { status: "no_match" | "unavailable" | "error"; message: string };

type SongProposalResult = {
  stageId: string;
  title: string;
  artist: string;
  votes: number;
  threshold: number;
  status: "proposed" | "confirmed";
};

type FeaturedSlot = {
  artist: string;
  startTs: string;
  status: "NOW" | "NEXT";
};

function stagePosition(stage: Stage) {
  const x = (stage.lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng);
  const y = (MAP_BOUNDS.maxLat - stage.lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
  return {
    left: `${31 + Math.max(0, Math.min(1, x)) * 39}%`,
    top: `${28 + Math.max(0, Math.min(1, y)) * 45}%`,
  };
}

function featuredSlot(stage: Stage, nowMs: number): FeaturedSlot | null {
  const current = stage.lineup.find(
    (slot) => Date.parse(slot.startTs) <= nowMs && Date.parse(slot.endTs) >= nowMs,
  );
  if (current) return { ...current, status: "NOW" };
  const next = stage.lineup.find((slot) => Date.parse(slot.startTs) > nowMs);
  return next ? { ...next, status: "NEXT" } : null;
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date(iso));
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the recording."));
    reader.onloadend = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      const encoded = value.split(",")[1];
      if (encoded) resolve(encoded);
      else reject(new Error("Could not encode the recording."));
    };
    reader.readAsDataURL(blob);
  });
}

function SongTools({
  stage,
  onSongUpdate,
}: {
  stage: Stage;
  onSongUpdate: (song: { title: string; artist: string; status: string }) => void;
}) {
  const [mode, setMode] = useState<"idle" | "recording" | "identifying" | "manual" | "submitting" | "result">("idle");
  const [secondsLeft, setSecondsLeft] = useState(RECORDING_SECONDS);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [source, setSource] = useState<"human" | "acrcloud">("human");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanUpCapture = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    stopTimerRef.current = null;
    tickTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    cleanUpCapture();
  }, [cleanUpCapture]);

  const finishCapture = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }, []);

  const startCapture = useCallback(async () => {
    setMessage(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("Microphone recording is unavailable in this browser. Enter the song manually.");
      setMode("result");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { autoGainControl: false, echoCancellation: false, noiseSuppression: false },
        video: false,
      });
      const mimeType = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"]
        .find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 96_000,
      });
      const chunks: Blob[] = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener("stop", async () => {
        const audio = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
        cleanUpCapture();
        if (!audio.size || audio.size >= MAX_AUDIO_BYTES) {
          setMessage("That recording was empty or too large. Try again.");
          setMode("result");
          return;
        }
        setMode("identifying");
        try {
          const response = await fetch("/api/identify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              stageId: stage.id,
              audioBase64: await blobToBase64(audio),
              mimeType: audio.type,
            }),
          });
          const result = (await response.json()) as SongRecognitionResult;
          if (result.status === "match") {
            setTitle(result.title);
            setArtist(result.artist);
            setSource("acrcloud");
            setConfidence(result.confidence);
            setMessage("Match found. Confirm it so the crowd can verify it.");
            setMode("manual");
          } else {
            setMessage(result.message);
            setMode("result");
          }
        } catch {
          setMessage("Couldn’t identify that sample. Enter it manually or try again.");
          setMode("result");
        }
      });
      recorder.start();
      setSecondsLeft(RECORDING_SECONDS);
      setMode("recording");
      tickTimerRef.current = setInterval(
        () => setSecondsLeft((value) => Math.max(0, value - 1)),
        1_000,
      );
      stopTimerRef.current = setTimeout(finishCapture, RECORDING_SECONDS * 1_000);
    } catch {
      cleanUpCapture();
      setMessage("Microphone access stayed private. You can enter the song manually.");
      setMode("result");
    }
  }, [cleanUpCapture, finishCapture, stage.id]);

  const submitSong = useCallback(async () => {
    if (!title.trim() || !artist.trim()) {
      setMessage("Enter both the song title and artist.");
      return;
    }
    setMode("submitting");
    setMessage(null);
    try {
      const response = await fetch("/api/songs/propose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stageId: stage.id,
          title,
          artist,
          source,
          ...(confidence !== null ? { confidence } : {}),
        }),
      });
      const result = (await response.json()) as SongProposalResult & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not submit that song.");
      const resultMessage = result.status === "confirmed"
        ? `${result.title} is confirmed at ${stage.name}.`
        : `${result.votes}/${result.threshold} people agree. One more vote can confirm it.`;
      setMessage(resultMessage);
      onSongUpdate({ title: result.title, artist: result.artist, status: result.status });
      setMode("result");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit that song.");
      setMode("manual");
    }
  }, [artist, confidence, onSongUpdate, source, stage.id, stage.name, title]);

  const reset = () => {
    setTitle("");
    setArtist("");
    setSource("human");
    setConfidence(null);
    setMessage(null);
    setMode("idle");
  };

  return (
    <section className="song-tools" aria-label={`Identify a song at ${stage.name}`}>
      <div className="song-tools__heading">
        <span>Community setlist</span>
        <h3>What song is this?</h3>
      </div>

      {mode === "idle" ? (
        <div className="song-tools__choices">
          <button className="song-action song-action--listen" onClick={startCapture} type="button">
            <span className="song-action__icon" aria-hidden="true">●</span>
            <span><strong>Listen for 10 seconds</strong><small>Mic sample · never retained</small></span>
          </button>
          <button className="song-action song-action--manual" onClick={() => setMode("manual")} type="button">
            Enter title and artist
          </button>
        </div>
      ) : null}

      {mode === "recording" ? (
        <div className="capture-state" role="status">
          <button className="capture-orb is-recording" onClick={finishCapture} type="button">
            <span>{secondsLeft}s</span>
            <small>Stop</small>
          </button>
          <strong>Listening at {stage.name}</strong>
          <p>Hold your phone toward the music.</p>
        </div>
      ) : null}

      {mode === "identifying" || mode === "submitting" ? (
        <div className="capture-state" role="status">
          <span className="web-spinner" aria-hidden="true" />
          <strong>{mode === "identifying" ? "Finding the song…" : "Submitting…"}</strong>
        </div>
      ) : null}

      {mode === "manual" ? (
        <form className="song-form" onSubmit={(event) => { event.preventDefault(); void submitSong(); }}>
          {message ? <p className="song-notice">{message}</p> : null}
          <label>Song title<input autoComplete="off" onChange={(event) => setTitle(event.target.value)} placeholder="What are they playing?" value={title} /></label>
          <label>Artist<input autoComplete="off" onChange={(event) => setArtist(event.target.value)} placeholder="Artist name" value={artist} /></label>
          <button className="confirm-song" type="submit">That’s playing</button>
        </form>
      ) : null}

      {mode === "result" ? (
        <div className="song-result" role="status">
          <span aria-hidden="true">✓</span>
          <strong>{message}</strong>
          <button onClick={reset} type="button">Try another</button>
        </div>
      ) : null}
    </section>
  );
}

export function CrowdListWebApp({
  initialSnapshot,
  initialNow,
}: {
  initialSnapshot: StageOneSnapshot;
  initialNow: number;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [refreshedAt, setRefreshedAt] = useState(initialNow);
  const [selectedStageId, setSelectedStageId] = useState(initialSnapshot.stages[0]?.id ?? "");
  const [reportedSongs, setReportedSongs] = useState<Record<string, { title: string; artist: string; status: string }>>({});
  const [apiStatus, setApiStatus] = useState<"live" | "offline">("live");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/stage-one", { cache: "no-store" });
      if (!response.ok) throw new Error("Snapshot unavailable");
      setSnapshot((await response.json()) as StageOneSnapshot);
      setRefreshedAt(Date.now());
      setApiStatus("live");
    } catch {
      setApiStatus("offline");
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const activePresence = useMemo(() => {
    const fresh = snapshot.presence.filter((item) => {
      const updatedAt = Date.parse(item.updatedAt);
      return Number.isFinite(updatedAt) && updatedAt >= refreshedAt - CROWD_WINDOW_MS;
    });
    return fresh.length ? fresh : snapshot.presence;
  }, [refreshedAt, snapshot.presence]);

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const item of activePresence) {
      result.set(item.stageId, (result.get(item.stageId) ?? 0) + 1);
    }
    return result;
  }, [activePresence]);

  const selectedStage = snapshot.stages.find((stage) => stage.id === selectedStageId)
    ?? snapshot.stages[0]
    ?? null;
  const busiest = Math.max(1, ...snapshot.stages.map((stage) => counts.get(stage.id) ?? 0));
  const lineupCount = snapshot.stages.reduce((total, stage) => total + stage.lineup.length, 0);

  return (
    <main className="web-app">
      <header className="web-header">
        <a className="web-brand" href="#top" aria-label="CrowdList home">
          <span>CL</span><strong>CrowdList</strong>
        </a>
        <div className="web-header__event">
          <span>Outside Lands 2026</span><small>Golden Gate Park · Friday</small>
        </div>
        <span className={`live-indicator ${apiStatus === "offline" ? "is-offline" : ""}`}>
          <i />{apiStatus === "live" ? "Live map" : "Reconnecting"}
        </span>
      </header>

      <section className="web-intro" id="top">
        <div><p className="web-eyebrow">Know before you go</p><h1>Find the crowd.<br />Name the song.</h1></div>
        <p>Live stage activity, current artists, and a crowd-built setlist for every corner of the festival.</p>
      </section>

      <section className="web-workspace">
        <div className="map-shell">
          <div className="festival-map" aria-label="Outside Lands live crowd heatmap">
            <Image
              alt="Outside Lands patron map"
              className="map-art"
              fill
              priority
              sizes="(max-width: 980px) 100vw, 68vw"
              src="/maps/ol26-patron-map.webp"
            />
            <div className="map-wash" />
            {snapshot.stages.map((stage) => {
              const count = counts.get(stage.id) ?? 0;
              const intensity = count / busiest;
              const slot = featuredSlot(stage, refreshedAt);
              const position = stagePosition(stage);
              const style = {
                ...position,
                "--heat-size": `${76 + intensity * 110}px`,
                "--heat-color": intensity >= 0.67 ? "255, 74, 76" : intensity >= 0.34 ? "255, 181, 46" : "37, 205, 153",
              } as CSSProperties;
              return (
                <button
                  aria-label={`${stage.name}: ${count} people nearby`}
                  className={`web-stage-marker ${selectedStage?.id === stage.id ? "is-selected" : ""}`}
                  key={stage.id}
                  onClick={() => setSelectedStageId(stage.id)}
                  style={style}
                  type="button"
                >
                  <i className="stage-heat" aria-hidden="true" />
                  <span className="stage-pin-count">{count}</span>
                  <strong>{stage.name}</strong>
                  {slot ? <small>{slot.status} · {slot.artist}</small> : null}
                </button>
              );
            })}
            <div className="map-key"><span><i className="calm" />Calm</span><span><i className="busy" />Busy</span><span><i className="packed" />Packed</span></div>
          </div>
          <div className="map-summary">
            <span><strong>{activePresence.length}</strong> people near stages</span>
            <span><strong>{snapshot.stages.length}</strong> stages</span>
            <span><strong>{lineupCount}</strong> Friday sets</span>
            <button onClick={() => void refresh()} type="button">Refresh map</button>
          </div>
        </div>

        {selectedStage ? (
          <aside className="stage-sheet">
            <div className="stage-sheet__top">
              <div><p className="web-eyebrow">Live stage</p><h2>{selectedStage.name}</h2></div>
              <span className="crowd-chip">{counts.get(selectedStage.id) ?? 0} nearby</span>
            </div>

            {reportedSongs[selectedStage.id] ? (
              <div className="now-playing-card is-community">
                <span>{reportedSongs[selectedStage.id].status === "confirmed" ? "Crowd confirmed" : "Awaiting agreement"}</span>
                <strong>{reportedSongs[selectedStage.id].title}</strong>
                <p>{reportedSongs[selectedStage.id].artist}</p>
              </div>
            ) : featuredSlot(selectedStage, refreshedAt) ? (
              <div className="now-playing-card">
                <span>{featuredSlot(selectedStage, refreshedAt)!.status === "NOW" ? "On stage now" : "Up next"}</span>
                <strong>{featuredSlot(selectedStage, refreshedAt)!.artist}</strong>
                <p>{formatTime(featuredSlot(selectedStage, refreshedAt)!.startTs)}</p>
              </div>
            ) : null}

            <SongTools
              key={selectedStage.id}
              onSongUpdate={(song) => setReportedSongs((current) => ({ ...current, [selectedStage.id]: song }))}
              stage={selectedStage}
            />

            <div className="lineup-preview">
              <div><span>Friday lineup</span><small>{selectedStage.lineup.length} sets</small></div>
              {selectedStage.lineup.slice(0, 4).map((slot) => (
                <p key={`${slot.artist}-${slot.startTs}`}><time>{formatTime(slot.startTs)}</time><strong>{slot.artist}</strong></p>
              ))}
            </div>
          </aside>
        ) : null}
      </section>

      <footer className="web-footer"><strong>CrowdList</strong><span>Built for Outside Lands · Audio samples are never retained</span></footer>
    </main>
  );
}
