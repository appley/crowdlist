# CrowdList — Build Spec

Live crowd heatmap and crowd-verified setlists for music festivals.
OutsideLLMS 2026 · Outside Lands · San Francisco

---

## 0. The constraint that drives everything

The sponsor board marks **ChatGPT Sites as REQUIRED**. Sites hosts web apps, web sites, and games with D1, R2, hosted env vars, and access controls. It does not host native mobile binaries.

This forces one decision and unlocks three more:

| Was | Becomes | Why it's better, not just compliant |
|---|---|---|
| Expo / React Native | Web app on ChatGPT Sites | No install. A festivalgoer scans a QR on a poster and is in. Install friction is fatal for a one-weekend product |
| Firebase | Convex | Reactive queries push heatmap deltas to every client with no polling loop. This is Convex's core competency and exactly our workload |
| `react-native-maps` | MapLibre GL JS | Free, no key, GPU-rendered heatmap layer built in |
| `expo-location` / `expo-av` | Geolocation API / MediaRecorder | Native browser APIs, no dependency |

We now use all four sponsors, and each for the thing it is actually best at.

---

## 1. Product thesis

At a six-stage festival you are permanently making two decisions blind: *where is it too packed right now*, and *what is actually playing over there*.

A schedule cannot answer either. It tells you who is booked for the hour. It does not tell you the set started twenty minutes late, that the last three songs were the deep cuts you came for, or that the walk to Sutro is currently a wall of people.

CrowdList makes the map live.

**Three surfaces:**
- **Crowd heatmap** — density per stage and along paths, right now
- **Now Playing** — the song on stage this minute, not the artist booked this hour
- **Live setlist** — rolling per-stage record, scrollable back through sets you missed

---

## 2. The technical differentiator

Open-world music recognition does not survive a festival. Stage bleed puts two songs in one microphone. Crowd noise buries the signal. DJ sets are edits and transitions no fingerprint database holds. Unreleased material returns nothing.

**So we never do open-world recognition. We do constrained inference over a candidate set.**

At any moment, on any stage, the space of songs that could be playing is small and knowable:

1. **JamBase gives us who is on that stage right now.** Normalized festival lineup and set times.
2. **JamBase gives us what they play.** 25+ years of setlist history, 5M+ performances. An artist's recent tour setlists narrow the field to roughly 20–40 songs.
3. **That candidate list becomes a prior.**

Now the pipeline is:

```
audio clip ──> AudD ──────────┐
                              │
JamBase candidates ───────────┼──> GPT-5 resolver ──> confidence
                              │         │
human votes / free text ──────┘         └──> below threshold? stay pending
                                             above threshold? post to setlist
```

The model is not guessing at a song from nothing. It is arbitrating between a weak fingerprint match, scattered human input, and a 30-song prior, with the songs already played this set excluded. That is a tractable problem where open-world ID is not.

**Crowd consensus remains the accuracy floor.** A track posts only when human agreement clears threshold. The model raises confidence and breaks ties; it does not get to publish on its own. The people standing in front of the speakers are better sensors than any API, and the threshold is what turns their scattered input into something publishable.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────┐
│  ChatGPT Sites  (required deploy target)        │
│  ┌───────────────────────────────────────────┐  │
│  │  Web client                               │  │
│  │  MapLibre heatmap · mic capture · voting  │  │
│  └────────────────┬──────────────────────────┘  │
│                   │                             │
│  ┌────────────────▼──────────────────────────┐  │
│  │  Server routes  (secrets in env vars)     │  │
│  │  /identify  /resolve  /agent              │  │
│  └────┬──────────────┬───────────────┬───────┘  │
└───────┼──────────────┼───────────────┼──────────┘
        │              │               │
   ┌────▼────┐   ┌─────▼─────┐   ┌─────▼─────┐
   │  AudD   │   │  JamBase  │   │  OpenAI   │
   │ finger- │   │ lineup ·  │   │ resolver  │
   │ print   │   │ setlists  │   │ + agent   │
   └─────────┘   └───────────┘   └───────────┘
                        │
                 ┌──────▼──────┐
                 │   Convex    │
                 │  reactive   │ ◄── all clients subscribe
                 │  backend    │
                 └─────────────┘
```

**Why Convex and not Sites' own D1:** D1 is request/response. Our entire product is "everyone sees the same thing update at once." Convex queries are reactive by default, so when a vote lands, every open client's setlist and heatmap re-render without a polling loop. Sites hosts the app; Convex is the live layer.

**Secrets discipline:** AudD, JamBase, and OpenAI keys all live in Sites hosted environment variables and are only ever touched by server routes. Never the client. JamBase v3 auth is a Bearer token in the Authorization header, which would trip CORS from a browser anyway.

---

## 4. Sponsor integration, concretely

### OpenAI
- **Sites** — the deploy target. Save a version, then deploy. Every deployment URL is production, so use save-version as the staging gate.
- **Resolver** — GPT-5 with structured outputs, arbitrating AudD confidence + JamBase candidates + human votes into a single track guess with a confidence score. Strict JSON, no prose.
- **Concierge agent** — function calling over `crowd_at(stage)`, `now_playing(stage)`, `setlist(stage)`, `walk_time(a,b)`. "I want to catch Charli but I hate crowds, what should I do" gets a real answer from live state.
- **Realtime API** *(stretch)* — hands-free voice mode. At a festival, typing is the wrong interface.

### JamBase
- **REST v3** — `/v3/events`, `/v3/artists`, `/v3/venues`. Lineup, per-stage set times, artist metadata, third-party IDs matched to Spotify and MusicBrainz.
- **Setlist history** — the candidate prior. This is the integration that matters.
- **MCP server** at `mcp.jambase.com/mcp` — wire it directly into the concierge agent's toolbelt instead of hand-rolling REST wrappers. OAuth 2.1 with DCR, so setup is a browser flow. One MCP call bills as one REST call.

### Convex
- Reactive queries for heatmap and setlist
- Mutations for votes and clip submissions
- Scheduled functions for the resolver sweep and density decay
- Server-side threshold logic so a client cannot post a track directly

### AudD
- Fingerprinting on captured clips. Feeds the resolver as one signal among three, never as truth.

---

## 5. Data model (Convex)

```ts
stages:      { name, lat, lng, jambaseVenueId, capacityHint }
sets:        { stageId, artistName, jambaseArtistId, startsAt, endsAt }
candidates:  { setId, title, source: "tour"|"catalog", priorWeight }
pings:       { stageId, bucketAt, count }          // aggregated, never raw traces
clips:       { setId, audioRef, auddResult, confidence, createdAt }
proposals:   { setId, title, votes, resolverScore, status: "pending"|"posted" }
setlist:     { setId, title, postedAt, agreementAtPost }
```

`pings` is written pre-aggregated. Individual location traces are never stored — this is a design decision, not a policy statement, and it should be true in the code.

---

## 6. Build order

**Phase 0 — unblock (30 min)**
Confirm Sites access. Deploy a blank page, open it on your phone over cellular. Spin up a Convex project. Pull the Outside Lands 2026 payload from JamBase and save it to a seed file.

**Phase 1 — the map is alive (60 min)**
MapLibre with six stages. Convex reactive query driving a heatmap layer. Seeded demo density so it renders with no live crowd. This alone demos.

**Phase 2 — capture and identify (60 min)**
MediaRecorder clip capture → server route → AudD. Show the raw result. No consensus yet.

**Phase 3 — the differentiator (60 min)**
JamBase set times decide the active artist per stage. Pull their recent setlists into `candidates`. Wire the GPT-5 resolver over AudD + candidates + votes. Threshold gate before posting.

**Phase 4 — voting UI (30 min)**
Confirm, correct, free-text entry. Live agreement count. Watch a track cross the threshold and post.

**Phase 5 — concierge (30 min)**
Function-calling agent over live state, JamBase MCP attached.

**Phase 6 — harden (45 min)**
Deploy to production URL. Run the demo four times against it, not localhost. Screen-record a backup. Flip access to anyone-with-link. Verify on cellular.

**Kill list, in order:** Realtime voice → concierge agent → free-text entry → resolver → live capture. Cutting everything still leaves a live reactive heatmap with seeded setlists, which is a demo.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| **No crowd at demo time** | Seeded historical density mode, clearly labeled as seeded. Build this in Phase 1, not at 5:30 |
| **iOS Safari mic permissions** | Requires HTTPS and a user gesture. Sites gives HTTPS. Test on a real iPhone early |
| **JamBase set times may not be stage-level** | Festival scheduling is the least normalized part of live music data. Check in Phase 0; hand-transcribe six stages in 20 min if missing |
| **Setlist history may be tier-gated** | Fall back to artist catalog via the matched Spotify/MusicBrainz IDs. Weaker prior, same architecture |
| **Rate limits** | Precache the lineup. Keep exactly one live JamBase call in the demo path for credibility, cache the rest |
| **Venue wifi at 6pm** | Everything demoed from the production URL over cellular. Backup recording ready |

---

## 8. What we claim, and what we don't

**Real:** stage positions, lineup and set times, fingerprint results, human votes, agreement threshold, live density from actual client pings.

**Seeded for demo:** crowd density, because there is no festival in the room.

Say it once, plainly, during the demo. Judges reward knowing the difference far more than they punish an honest gap.

---

## 9. Demo, three minutes

Open cold on the live map, density breathing. Four seconds, no talking.

State the problem: a schedule tells you who is booked. It cannot tell you the set is running late, or that the walk to Sutro is a wall of people.

Put the URL on screen. Tell the room to open it. Judges independently poking a live reactive map beats anything you can say — and their pings show up on your heatmap in real time, which is the demo demoing itself.

Capture a clip live. Show AudD returning something weak. Show the JamBase candidate list narrowing it. Show the resolver picking. Show the vote count crossing threshold and the track posting to the setlist.

Land it: we never do open-world song ID. We do constrained inference over a candidate set the live music graph already knows, and we let the crowd have the final vote.

Close on the concierge: ask it where to go next, live.