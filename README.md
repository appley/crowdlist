# CrowdList

**Live crowd heatmap + real-time setlists for music festivals.** Built for the
Outside Lands hackathon. The product combines crowd density, Now Playing, and a
rolling stage setlist powered by music recognition plus human agreement.

This branch contains **Stage 1 only**:

- Expo SDK 54 + React Native + TypeScript scaffold that runs in Expo Go.
- A Sites-hosted D1 backend with a deliberately thin repository interface.
- All five requested data-model areas: stages, presence, now playing, proposals,
  and cached setlist items.
- The official 2026 Friday schedule for seven Outside Lands stages.
- Seed, crowd simulation, and combined reseed scripts.
- A backend inspector page for verifying the seed and raw simulated records.

Map/location/audio, AudD, OpenAI normalization, nearest-stage logic, crowd-window
aggregation, voting, promotion, and setlist transitions are intentionally not
implemented until Stage 2 or Stage 3.

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

Start the backend inspector:

```bash
npm run dev
```

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

Refresh the backend inspector to see those stage and presence records. For a
larger or deterministic crowd, edit `SIMULATED_PRESENCE_COUNT` or
`SIMULATION_SEED` in `.env`.

## Run the Expo Go scaffold

Set `EXPO_PUBLIC_CROWDLIST_API_URL` in `mobile/.env` to a URL your phone can
reach, then run:

```bash
npm run mobile
```

Scan the QR code with Expo Go. The current mobile screen is intentionally a
Stage 1 shell; it does not request location or audio permission yet.

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

Admin routes require `x-crowdlist-admin-token` to match the server-side
`CROWDLIST_ADMIN_TOKEN` environment variable.
