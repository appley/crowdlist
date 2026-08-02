# Project Memory

This file contains durable, verified context for future work. Keep it concise
and current. Update existing sections instead of appending a task diary.

## Product

- **Name:** CrowdList.
- **Purpose:** Live crowd intelligence and crowd-verified setlists for music
  festivals.
- **Origin:** Built at OutsideLLMS 2026 for Outside Lands in San Francisco on
  August 2, 2026.
- **Current status:** One-day hackathon prototype.

## Documented Behavior

- Shows crowd density around festival stages in real time.
- Shows the current song at each stage.
- Maintains a rolling live setlist and cached song history for each stage.
- Provides a concierge driven by live crowd state, set times, and current songs.
- Song identification uses constrained inference over candidate songs derived
  from the current artist and recent live setlists.
- Resolution combines a candidate prior, fingerprinting, and human input.
- A song is posted only after it passes a human-agreement threshold.
- Location pings are aggregated into density buckets before storage; individual
  traces are not stored. Microphone access is prompted per clip.

## Documented Technology

- Browser-based TypeScript client using the Geolocation API and MediaRecorder.
- ChatGPT Sites for hosting and deployment.
- Convex for the realtime backend.
- JamBase v3 API and MCP server for lineup, set times, and matched artist IDs.
- setlist.fm, keyed by MusicBrainz MBID, for recent setlist history.
- OpenAI for structured-output resolution and the function-calling concierge.
- ACRCloud for audio fingerprinting.
- MapLibre GL JS for the map.

## Repository State

- The repository contains a ChatGPT Sites/vinext TypeScript web app plus product
  documentation and intent-focused tests.
- Active development happens on the `krish-dev` branch.
- `.openai/hosting.json` binds the repository to its ChatGPT Sites project.

## Implemented Experience

- Responsive MapLibre festival map with six interactive stage markers and a
  clearly labeled seeded crowd heatmap.
- Now Playing details, crowd-verification threshold, live setlist views, stage
  search, a device-local day plan, and a bounded concierge experience.
- User-initiated eight-second MediaRecorder capture with no continuous mic use.
- Service-worker shell caching, offline state messaging, and device-local vote
  and plan persistence.
- Server-only routes for JamBase event lookup, setlist.fm candidate generation,
  ACRCloud fingerprinting, GPT-5 structured resolution, and a tool-calling
  OpenAI concierge.
- Sponsor integrations return explicit unavailable errors when their hosted
  credentials are absent; the client falls back only to labeled seeded or
  downloaded state.

## External Configuration Still Required

- Hosted OpenAI, ACRCloud, JamBase, and setlist.fm credentials are not present
  in the repository and must be configured through ChatGPT Sites environment
  variables.
- Convex project authorization was attempted but not completed. The deployed
  demo does not claim a live Convex subscription until a deployment URL and
  generated API are configured.

## Authoritative Build Specification

- `BUILD_SPEC.md` is the authoritative implementation specification.
- ChatGPT Sites is the required host and deployment target; Convex is the
  reactive live-data layer.
- The core build order is: platform access and seed data, live map, capture and
  fingerprinting, constrained resolver, voting, concierge, then hardening.
- The core demo remains viable if stretch features are cut in this order:
  Realtime voice, concierge, free-text entry, resolver, then live capture.
- ACRCloud is the selected fingerprinting provider. The `auddResult` property in
  the spec's example `clips` model is stale naming and must not be interpreted
  as an AudD integration.
- The concierge is a planned Phase 5 feature and is cuttable; the three core
  product surfaces are crowd heatmap, Now Playing, and live setlists.

## Documented Roadmap

- Rolling setlist accuracy with weighted, abuse-resistant voting.
- Cross-stage recommendations and notifications when tracked artists start.
- Voice mode through the Realtime API.
- Offline support for on-site dead zones.
- Setlist export for artists and live-music databases.

## Memory Maintenance

- Record only facts verified from repository files, tests, or explicit user
  decisions.
- Do not store secrets, credentials, guesses, temporary debugging notes, or
  completed-task narration.
- Update or remove stale facts when the implementation changes.
