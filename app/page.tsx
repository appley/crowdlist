"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  LocateFixed,
  Map as MapIcon,
  Mic,
  Music2,
  Navigation,
  Pause,
  Radio,
  Search,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import * as maplibregl from "maplibre-gl";
import { FileSource, PMTiles, Protocol } from "pmtiles";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Stage = {
  id: string;
  name: string;
  artist: string;
  song: string;
  next: string;
  nextTime: string;
  crowd: number;
  confidence: "High" | "Medium";
  walk: number;
  color: string;
  coordinates: [number, number];
  history: string[];
};

const stages: Stage[] = [
  {
    id: "lands-end",
    name: "Lands End",
    artist: "Tyler, The Creator",
    song: "EARFQUAKE",
    next: "Hozier",
    nextTime: "7:35 PM",
    crowd: 78,
    confidence: "High",
    walk: 9,
    color: "#ff6048",
    coordinates: [-122.4926, 37.7687],
    history: ["WUSYANAME", "See You Again", "NEW MAGIC WAND"],
  },
  {
    id: "twin-peaks",
    name: "Twin Peaks",
    artist: "Charli xcx",
    song: "Von dutch",
    next: "Kaytranada",
    nextTime: "7:20 PM",
    crowd: 91,
    confidence: "High",
    walk: 6,
    color: "#ff3e8a",
    coordinates: [-122.4838, 37.7696],
    history: ["360", "Club classics", "Talk talk"],
  },
  {
    id: "sutro",
    name: "Sutro",
    artist: "Doechii",
    song: "DENIAL IS A RIVER",
    next: "Jamie xx",
    nextTime: "7:10 PM",
    crowd: 64,
    confidence: "High",
    walk: 4,
    color: "#ffb347",
    coordinates: [-122.4868, 37.7711],
    history: ["NISSAN ALTIMA", "Alter Ego", "What It Is"],
  },
  {
    id: "panhandle",
    name: "Panhandle",
    artist: "Anderson .Paak",
    song: "Come Down",
    next: "The Marias",
    nextTime: "7:30 PM",
    crowd: 43,
    confidence: "Medium",
    walk: 12,
    color: "#67d997",
    coordinates: [-122.4817, 37.7702],
    history: ["Am I Wrong", "Tints", "Make It Better"],
  },
  {
    id: "presidio",
    name: "Presidio",
    artist: "Vampire Weekend",
    song: "A-Punk",
    next: "Mk.gee",
    nextTime: "7:45 PM",
    crowd: 52,
    confidence: "Medium",
    walk: 8,
    color: "#6fc3ff",
    coordinates: [-122.489, 37.7674],
    history: ["Harmony Hall", "Diane Young", "Oxford Comma"],
  },
  {
    id: "cocktail-magic",
    name: "Cocktail Magic",
    artist: "Floating Points",
    song: "Birth4000",
    next: "DJ Seinfeld",
    nextTime: "8:00 PM",
    crowd: 29,
    confidence: "Medium",
    walk: 10,
    color: "#a889ff",
    coordinates: [-122.4777, 37.7719],
    history: ["Vocoder", "Problems", "LesAlpx"],
  },
];

const tabs = ["Map", "Setlists", "My day", "Ask"] as const;
type Tab = (typeof tabs)[number];

function CrowdMap({ selected, onSelect }: { selected: Stage; onSelect: (stage: Stage) => void }) {
  const mapNode = useRef<HTMLDivElement>(null);
  const liveMap = useRef<maplibregl.Map | null>(null);
  const markerNodes = useRef(new Map<string, HTMLButtonElement>());
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!mapNode.current) return;
    let map: maplibregl.Map | undefined;
    let removeProtocol: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const tileResponse = await fetch("/crowdsim/tiles/outside-lands.pmtiles");
      if (!tileResponse.ok) throw new Error("Basemap archive unavailable");
      const tileBlob = await tileResponse.blob();
      if (cancelled || !mapNode.current) return;
      const protocol = new Protocol();
      const tileFile = new File([tileBlob], "outside-lands");
      protocol.add(new PMTiles(new FileSource(tileFile)));
      maplibregl.addProtocol("pmtiles", protocol.tile);
      removeProtocol = () => maplibregl.removeProtocol("pmtiles");
      const instance = new maplibregl.Map({
        container: mapNode.current,
        center: [-122.4905, 37.7692],
        zoom: 14.75,
        attributionControl: false,
        maxBounds: [[-122.524, 37.751], [-122.455, 37.788]],
        style: {
          version: 8,
          sources: {
            protomaps: { type: "vector", url: "pmtiles://outside-lands" },
            openstreetmap: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 19,
            },
          },
          layers: [
            { id: "background", type: "background", paint: { "background-color": "#f3f4ef" } },
            { id: "earth", type: "fill", source: "protomaps", "source-layer": "earth", paint: { "fill-color": "#f3f4ef" } },
            { id: "water", type: "fill", source: "protomaps", "source-layer": "water", paint: { "fill-color": "#b9dded" } },
            { id: "landuse", type: "fill", source: "protomaps", "source-layer": "landuse", paint: { "fill-color": "#d9e8d2", "fill-opacity": 0.92 } },
            { id: "buildings", type: "fill", source: "protomaps", "source-layer": "buildings", paint: { "fill-color": "#e5e3dd", "fill-outline-color": "#d4d1c9", "fill-opacity": 0.92 } },
            { id: "road-casing", type: "line", source: "protomaps", "source-layer": "roads", paint: { "line-color": "#d3d0c8", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.8, 16, 7.2], "line-opacity": 0.78 } },
            { id: "roads", type: "line", source: "protomaps", "source-layer": "roads", paint: { "line-color": "#fffefa", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.8, 16, 5.2], "line-opacity": 0.98 } },
            { id: "street-map", type: "raster", source: "openstreetmap", paint: { "raster-saturation": -0.34, "raster-contrast": -0.08, "raster-brightness-min": 0.08, "raster-brightness-max": 0.96 } },
          ],
        },
      });
      map = instance;
      liveMap.current = instance;
      const syncMarkers = () => {
        for (const stage of stages) {
          const point = instance.project(stage.coordinates);
          const marker = markerNodes.current.get(stage.id);
          if (marker) marker.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
        }
      };
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      instance.on("move", syncMarkers);
      instance.on("resize", syncMarkers);
      instance.on("style.load", () => {
        instance.addSource("crowds", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: stages.map((stage, i) => ({
              type: "Feature",
              properties: { weight: stage.crowd / 100 },
              geometry: {
                type: "Point",
                coordinates: stage.coordinates,
              },
              id: i,
            })),
          },
        });
        instance.addLayer({
          id: "heat",
          type: "heatmap",
          source: "crowds",
          paint: {
            "heatmap-weight": ["get", "weight"],
            "heatmap-intensity": 1.35,
            "heatmap-radius": 62,
            "heatmap-opacity": 0.74,
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(69,217,151,0)", 0.18, "rgba(103,217,151,.7)",
              0.42, "rgba(255,206,92,.78)", 0.68, "rgba(255,111,62,.84)", 1, "rgba(255,46,99,.92)",
            ],
          },
        });
        syncMarkers();
        setMapStatus("ready");
      });
    })().catch(() => { if (!cancelled) setMapStatus("error"); });

    return () => {
      cancelled = true;
      liveMap.current = null;
      map?.remove();
      removeProtocol?.();
    };
  }, []);

  return (
    <div className="map-canvas" aria-label="Festival crowd map">
      <div ref={mapNode} className="maplibre-host" />
      <div className="map-grain" />
      {mapStatus === "loading" && <div className="map-loading"><span /> Loading festival map…</div>}
      {mapStatus === "error" && <div className="map-loading error">Map unavailable · stage data is still available</div>}
      <div className="map-context"><small>OUTSIDE LANDS · SUNDAY</small><strong>Golden Gate Park</strong><span><i /> 6 stages reporting live</span></div>
      {stages.map((stage) => (
        <button
          key={stage.id}
          ref={(node) => { if (node) markerNodes.current.set(stage.id, node); else markerNodes.current.delete(stage.id); }}
          className={`stage-marker ${selected.id === stage.id ? "selected" : ""}`}
          style={{ "--stage": stage.color } as React.CSSProperties}
          onClick={() => onSelect(stage)}
          aria-label={`${stage.name}, ${stage.crowd}% crowd, ${stage.artist} playing`}
        >
          <span className="marker-pulse" />
          <span className="marker-core"><Music2 size={14} /></span>
          <span className="marker-label"><strong>{stage.name}</strong><small>{stage.crowd}% full</small></span>
        </button>
      ))}
      <div className="map-actions">
        <button onClick={() => liveMap.current?.easeTo({ center: [-122.4905, 37.7692], zoom: 14.75, duration: 650 })} aria-label="Center map on the festival"><LocateFixed /></button>
      </div>
      <div className="map-key"><span /><span /><span /> Quiet <b>→</b> Packed</div>
      <div className="map-attribution">© OpenStreetMap contributors · Protomaps</div>
    </div>
  );
}

export default function Home() {
  const [selected, setSelected] = useState(stages[2]);
  const [tab, setTab] = useState<Tab>("Map");
  const [panelOpen, setPanelOpen] = useState(true);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [captureResult, setCaptureResult] = useState("");
  const [votes, setVotes] = useState<Record<string, number>>({ "lands-end": 3, "twin-peaks": 7, sutro: 2 });
  const [plans, setPlans] = useState<string[]>(["twin-peaks"]);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(true);
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState("Sutro is your best move: Doechii is on now, crowd level is comfortable, and it’s a 4-minute walk.");
  const [storageReady, setStorageReady] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const hadServiceWorker = "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    const refreshForUpdate = () => {
      if (hadServiceWorker && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    const networkStatusTimer = window.setTimeout(() => setOnline(navigator.onLine), 0);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", refreshForUpdate);
      void navigator.serviceWorker.register("/sw.js");
    }
    try {
      const savedVotes = window.localStorage.getItem("crowdlist-votes");
      const savedPlans = window.localStorage.getItem("crowdlist-plan");
      if (savedVotes) setVotes(JSON.parse(savedVotes) as Record<string, number>);
      if (savedPlans) setPlans(JSON.parse(savedPlans) as string[]);
    } catch {
      // The app remains usable when private browsing blocks local storage.
    }
    setStorageReady(true);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.clearTimeout(networkStatusTimer);
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("controllerchange", refreshForUpdate);
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem("crowdlist-votes", JSON.stringify(votes));
      window.localStorage.setItem("crowdlist-plan", JSON.stringify(plans));
    } catch {
      // Device-local persistence is optional; live UI state still works.
    }
  }, [votes, plans, storageReady]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const agreement = votes[selected.id] ?? 1;
  const posted = agreement >= 3;
  const sortedStages = useMemo(() => [...stages].sort((a, b) => b.crowd - a.crowd), []);
  const searchResults = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? stages.filter((stage) => `${stage.name} ${stage.artist} ${stage.song}`.toLowerCase().includes(needle)).slice(0, 4) : [];
  }, [search]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function selectStage(stage: Stage) {
    setSelected(stage);
    setTab("Map");
    setPanelOpen(true);
  }

  function confirmSong() {
    setVotes((current) => ({ ...current, [selected.id]: (current[selected.id] ?? 1) + 1 }));
    notify(agreement + 1 >= 3 ? `${selected.song} crossed the publish threshold` : "Your confirmation was counted");
  }

  function togglePlan(stageId: string) {
    setPlans((current) => current.includes(stageId) ? current.filter((id) => id !== stageId) : [...current, stageId]);
  }

  async function startCapture() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      notify("Audio capture is not supported by this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      setCaptureResult("");
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const clip = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void identifyClip(clip);
      };
      recorder.start();
      setRecordSeconds(0);
      setRecording(true);
      window.setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
          recorder.stream.getTracks().forEach((track) => track.stop());
          setRecording(false);
          setRecordSeconds(8);
        }
      }, 8000);
    } catch {
      notify("Microphone permission is required for a clip");
    }
  }

  function stopCapture() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    setRecording(false);
  }

  async function identifyClip(clip: Blob) {
    setCaptureResult("Checking the fingerprint against ACRCloud…");
    const data = new FormData();
    data.append("clip", clip, "crowdlist-clip.webm");
    data.append("stage", selected.name);
    try {
      const response = await fetch("/api/identify", { method: "POST", body: data });
      const result = await response.json() as { title?: string; artist?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Fingerprinting unavailable");
      setCaptureResult(result.title ? `Fingerprint candidate: ${result.title}${result.artist ? ` · ${result.artist}` : ""}` : "No fingerprint match. Add a crowd vote instead.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fingerprinting unavailable";
      setCaptureResult(message);
      notify(message);
    }
  }

  async function askConcierge(event: FormEvent) {
    event.preventDefault();
    const normalized = question.toLowerCase();
    const quietest = [...stages].sort((a, b) => a.crowd - b.crowd)[0];
    const answer = normalized.includes("quiet") || normalized.includes("crowd")
      ? `${quietest.name} is the calmest right now at ${quietest.crowd}% capacity. ${quietest.artist} is playing ${quietest.song}.`
      : normalized.includes("charli")
        ? `Go to Twin Peaks now. Charli xcx is playing Von dutch and it’s ${stages[1].crowd}% full, about ${stages[1].walk} minutes away.`
        : `${selected.name} is ${selected.crowd}% full. ${selected.artist} is playing ${selected.song}; ${selected.next} starts at ${selected.nextTime}.`;
    setChat("Checking live festival state…");
    setQuestion("");
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, selectedStage: selected.id, stages }),
      });
      const result = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || "Concierge unavailable");
      setChat(result.answer);
    } catch {
      setChat(answer);
      notify("OpenAI is not connected — answered from the downloaded festival state");
    }
  }

  return (
    <main className="app-shell">
      {!online && <div className="offline-banner">You’re offline — showing the last downloaded festival state.</div>}
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Radio size={18} /></span><span>Crowd<span>List</span></span></div>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {tabs.map((item) => (
            <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
              {item === "Map" ? <MapIcon /> : item === "Setlists" ? <Music2 /> : item === "My day" ? <CalendarDays /> : <Sparkles />}
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-stages">
          <p className="eyebrow">Stages right now</p>
          {sortedStages.map((stage) => (
            <button key={stage.id} className={selected.id === stage.id ? "active" : ""} onClick={() => selectStage(stage)}>
              <span className="crowd-dot" style={{ background: stage.color }} />
              <span><strong>{stage.name}</strong><small>{stage.artist}</small></span>
              <b>{stage.crowd}%</b>
            </button>
          ))}
        </div>
        <div className="sidebar-footer"><CircleHelp size={17} /><span>How live data works</span><a href="/crowdsim/">Open data portrait <ArrowRight size={13} /></a></div>
      </aside>

      <section className={`main-view ${tab === "Map" ? "map-mode" : ""}`}>
        <header className="topbar">
          <div className="mobile-brand brand"><span className="brand-mark"><Radio size={17} /></span><span>Crowd<span>List</span></span></div>
          <div className="search-wrap">
            <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search artists or stages" placeholder="Search artists or stages" /></label>
            {search.trim() && <div className="search-results">{searchResults.length ? searchResults.map((stage) => <button key={stage.id} onClick={() => { selectStage(stage); setSearch(""); }}><span><strong>{stage.artist}</strong><small>{stage.name} · {stage.song}</small></span><ChevronRight /></button>) : <p>No live match yet</p>}</div>}
          </div>
          <div className="status-chip"><i /> Live · updated now</div>
          <div className="demo-chip">Seeded demo</div>
          <button className="avatar" aria-label="Open profile">VK</button>
        </header>

        {tab === "Map" && (
          <div className="map-view">
            <CrowdMap selected={selected} onSelect={selectStage} />
          </div>
        )}

        {tab === "Setlists" && (
          <div className="content-view">
            <div className="content-heading"><p className="eyebrow">Crowd verified</p><h1>Live setlists</h1><p>Every song happening across the park, updated as the crowd agrees.</p></div>
            <div className="setlist-grid">
              {stages.map((stage) => <StageCard key={stage.id} stage={stage} onOpen={() => selectStage(stage)} />)}
            </div>
          </div>
        )}

        {tab === "My day" && (
          <div className="content-view">
            <div className="content-heading"><p className="eyebrow">Your festival</p><h1>My day</h1><p>A lightweight plan that stays available even when the signal doesn’t.</p></div>
            <div className="plan-list">
              {stages.map((stage) => (
                <article key={stage.id} className={plans.includes(stage.id) ? "planned" : ""}>
                  <div><span>{stage.nextTime}</span><h3>{stage.next}</h3><p>{stage.name} · about {stage.walk} min away</p></div>
                  <button onClick={() => togglePlan(stage.id)}>{plans.includes(stage.id) ? <><Check size={16} /> Added</> : "Add"}</button>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "Ask" && (
          <div className="concierge-view">
            <div className="concierge-orb"><Sparkles /></div>
            <p className="eyebrow">CrowdList concierge</p>
            <h1>Where should we go next?</h1>
            <p className="concierge-copy">Ask about crowds, current songs, set times, or the fastest move across the park.</p>
            <div className="answer-card"><span><Sparkles size={18} /></span><p>{chat}</p></div>
            <div className="suggestions">
              {["Where is it quiet?", "Can I still catch Charli?", `What’s next at ${selected.name}?`].map((prompt) => <button key={prompt} onClick={() => setQuestion(prompt)}>{prompt}</button>)}
            </div>
            <form onSubmit={askConcierge} className="ask-form"><input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about the festival…" aria-label="Ask the concierge" /><button disabled={!question.trim()} aria-label="Send question"><Send size={18} /></button></form>
            <small className="demo-note">Demo guide uses the live seeded state. Connect OpenAI to enable free-form answers.</small>
          </div>
        )}
      </section>

      {tab === "Map" && panelOpen && (
        <aside className="stage-panel">
          <div className="panel-handle" />
          <button className="close-panel" onClick={() => setPanelOpen(false)} aria-label="Close stage panel"><X /></button>
          <div className="stage-kicker"><span style={{ background: selected.color }} /> {selected.name}<b>{selected.crowd}% full</b></div>
          <h1>{selected.artist}</h1>
          <div className="now-playing">
            <div className="album-art"><span>{selected.artist.split(" ").map((word) => word[0]).join("").slice(0, 2)}</span><i /></div>
            <div><p><span /> NOW PLAYING</p><h2>{selected.song}</h2><small>{selected.artist}</small></div>
            <button className="pause" aria-label="Pause preview"><Pause size={17} /></button>
          </div>
          <div className="agreement-row">
            <div><Users size={16} /><span><strong>{agreement} people agree</strong><small>{posted ? "Crowd verified" : `${3 - agreement} more needed to publish`}</small></span></div>
            <span className={posted ? "verified" : "pending"}>{posted ? <><Check size={13} /> Verified</> : "Pending"}</span>
          </div>
          <div className="panel-buttons">
            <button className="primary" onClick={confirmSong}><Check size={18} /> That’s playing</button>
            <button className="secondary" onClick={() => setCaptureOpen(true)}><Mic size={18} /> Identify song</button>
          </div>
          <div className="panel-stats"><span><Navigation />{selected.walk} min walk</span><span><Users />{selected.crowd}% crowd</span><span><Radio />{selected.confidence} confidence</span></div>
          <button className="up-next" onClick={() => togglePlan(selected.id)}><span><small>UP NEXT · {selected.nextTime}</small><strong>{selected.next}</strong></span><span>{plans.includes(selected.id) ? <Check /> : <ChevronRight />}</span></button>
          <div className="recent-list"><div><span>RECENTLY PLAYED</span><button onClick={() => setTab("Setlists")}>Full setlist <ArrowRight size={14} /></button></div>{selected.history.map((song, i) => <p key={song}><b>{i + 1}</b><span>{song}<small>{selected.artist}</small></span><time>{6 + i * 5}m ago</time></p>)}</div>
        </aside>
      )}

      <nav className="mobile-nav" aria-label="Primary navigation">
        {tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "Map" ? <MapIcon /> : item === "Setlists" ? <Music2 /> : item === "My day" ? <CalendarDays /> : <Sparkles />}<span>{item}</span></button>)}
      </nav>

      {captureOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !recording && setCaptureOpen(false)}>
          <section className="capture-modal" role="dialog" aria-modal="true" aria-labelledby="capture-title" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setCaptureOpen(false)} disabled={recording} aria-label="Close"><X /></button>
            <div className={`record-orb ${recording ? "recording" : ""}`}><Mic /></div>
            <p className="eyebrow">{selected.name}</p>
            <h2 id="capture-title">{recording ? "Listening…" : recordSeconds ? "Clip captured" : "Identify this song"}</h2>
            <p>{recording ? "Hold your phone toward the stage. Recording stops automatically at 8 seconds." : recordSeconds ? captureResult || "Preparing your clip…" : "CrowdList records one short clip only after you tap. The mic is never held open."}</p>
            {recording && <div className="record-progress"><span style={{ width: `${Math.min(recordSeconds / 8, 1) * 100}%` }} /></div>}
            <button className="capture-button" onClick={recording ? stopCapture : startCapture}>{recording ? <><Pause /> Stop · {recordSeconds}s</> : <><Mic /> Record 8-second clip</>}</button>
            <small>Audio is never retained or used for training.</small>
          </section>
        </div>
      )}
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </main>
  );
}

function StageCard({ stage, onOpen }: { stage: Stage; onOpen: () => void }) {
  return (
    <button className="stage-card" onClick={onOpen}>
      <div className="stage-card-top"><span><i style={{ background: stage.color }} />{stage.name}</span><b>{stage.crowd}%</b></div>
      <p>NOW PLAYING</p><h2>{stage.song}</h2><h3>{stage.artist}</h3>
      <div className="mini-history">{stage.history.slice(0, 2).map((song) => <span key={song}><Music2 size={13} />{song}</span>)}</div>
      <footer><span><Clock3 size={14} /> Updated now</span><ChevronRight size={17} /></footer>
    </button>
  );
}
