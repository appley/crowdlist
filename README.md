# CrowdList

**Live crowd heatmap + real-time setlists for music festivals.** Built for the
Outside Lands hackathon. The product combines crowd density, Now Playing, and a
rolling stage setlist powered by music recognition plus human agreement.

This branch contains the **CrowdList demo experience and data foundation**:

- Expo SDK 54 + React Native + TypeScript scaffold that runs in Expo Go.
- A Sites-hosted D1 backend with a deliberately thin repository interface.
- All five requested data-model areas: stages, presence, now playing, proposals,
  and cached setlist items.
- The official 2026 Friday schedule for seven Outside Lands stages.
- Seed, crowd simulation, and combined reseed scripts.
- A responsive Sites web app with the Outside Lands patron map, crowd hotspots,
  stage schedule, and song-entry flow.
- An Expo Go map that renders recent presence as per-stage crowd hotspots and
  refreshes from the backend every 15 seconds.
- A stage-level song flow with manual entry, human-agreement promotion, and an
  optional 10-second ACRCloud recognition sample.

Location heartbeat, OpenAI normalization, nearest-stage assignment, voter
identity, and setlist transitions are not implemented yet. The map currently
visualizes seeded or simulated presence from the existing API.

## Why Expo SDK 54

The requested `expo-av` API is deprecated and was removed after SDK 54. SDK 54 is
therefore pinned so this scaffold satisfies both requirements: `expo-av` and a
physical-device Expo Go demo. No custom map provider or native-only dependency is
configured. Stage 3 should use the default map provider and `<Circle>` overlays.

## Install

```bash
npm install
npm --prefix mobile install
cp .env.example .env
cp mobile/.env.example mobile/.env
```

Replace `CROWDLIST_ADMIN_TOKEN` in `.env` with a long random value. Keep AudD and
OpenAI tokens server-side; never expose them through an `EXPO_PUBLIC_*` variable.

## Run and verify Stage 1 locally

Start the Sites web app and backend:

```bash
npm run dev
```

On a machine that cannot run the Cloudflare local runtime, start the lightweight
in-memory demo API instead:

```bash
npm run demo:server
```

The demo API supports the same Stage 1 snapshot, seed, and simulate routes used
by the Expo app and scripts. It is intentionally non-persistent.

In a second terminal, seed and simulate:

```bash
npm run seed
npm run simulate
```

Or reset everything in one command before a demo:

```bash
npm run reseed
```

Expected output:

```text
Seed verified: 7 stages and 49 Friday lineup slots.
Simulation verified: 96 fresh presence records across 7 stages.
```

Refresh the web heatmap to see those stage and presence records. For a
larger or deterministic crowd, edit `SIMULATED_PRESENCE_COUNT` or
`SIMULATION_SEED` in `.env`.

## Run the Expo Go scaffold

Set `EXPO_PUBLIC_CROWDLIST_API_URL` in `mobile/.env` to a URL your phone can
reach, then run:

```bash
npm run mobile
```

Scan the QR code with Expo Go. The app shows the seven stages and counts presence
heartbeats updated within the last two minutes. It refreshes every 15 seconds.
It requests microphone permission only when the user starts song recognition;
location heartbeat is not implemented yet.

## Identify or enter a song

Tap a stage marker, then tap **Identify song**. Manual title/artist submission
works without provider credentials. For audio recognition, configure these
server-only values in the root `.env` or hosted environment:

```text
ACRCLOUD_HOST=identify-us-west-2.acrcloud.com
ACRCLOUD_ACCESS_KEY=...
ACRCLOUD_ACCESS_SECRET=...
```

The app records one 10-second sample and does not retain it. A recognition match
must still be confirmed by the user. `CROWDLIST_DEMO_THRESHOLD_ENABLED=true`
confirms the first submission; otherwise `CROWDLIST_AGREEMENT_THRESHOLD`
defaults to two.

## Backend seam

Server routes use `CrowdListRepository`; scripts use its HTTP implementation;
the mobile app uses `CrowdListDataSource`. If the event chooses Firebase,
Supabase, or another realtime store, replace those adapters while keeping the
domain types and later product logic unchanged.

## Collections → D1 tables

| Requested collection | D1 table | Key |
| --- | --- | --- |
| `stages/{stageId}` | `stages` | `id` |
| `presence/{userId}` | `presence` | `user_id` |
| `nowPlaying/{stageId}` | `now_playing` | `stage_id` |
| `proposals/{stageId}/items/{id}` | `proposals` | `id`, indexed by `stage_id` |
| `stages/{stageId}/setlist/{id}` | `setlist_items` | `id`, indexed by `stage_id` |

## API surface in Stage 1

- `GET /api/stage-one` — raw stage and presence snapshot.
- `POST /api/admin/seed` — protected full Stage 1 reset + stage seed.
- `POST /api/admin/simulate` — protected replacement of simulated presence.
- `POST /api/identify` — server-side ACRCloud audio identification.
- `POST /api/songs/propose` — manual or recognized song proposal and agreement
  promotion.

Admin routes require `x-crowdlist-admin-token` to match the server-side
`CROWDLIST_ADMIN_TOKEN` environment variable.
