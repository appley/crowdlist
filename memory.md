# Project Memory

This file contains durable, verified context for future work. Keep it concise
and current. Update existing sections instead of appending a task diary.

## Product

- **Name:** CrowdList.
- **Purpose:** A live crowd heatmap and real-time setlist experience for Outside
  Lands.
- **Current status:** Stage 1 MVP data foundation is implemented on `pomme-v1`.

## Product Decisions

- The Nearby view will be a festival map with crowd-density overlays; it will
  not show an aggregate total-crowd number.
- Song identification combines AudD recognition with human input and voting.
- OpenAI will normalize song guesses before the human-agreement threshold is
  applied.
- The agreement threshold can drop to one through a demo flag.

## Technology

- Expo SDK 54, React Native, and TypeScript, compatible with Expo Go.
- `expo-location` for location and `expo-av` for short audio capture.
- `react-native-maps` using the default provider and `Circle` overlays rather
  than a native heatmap provider.
- A Sites-hosted D1 implementation sits behind repository/data-source seams so
  the event backend can be replaced.
- AudD and OpenAI credentials remain server-side in ignored environment files.

## Stage 1 Repository State

- The Expo application scaffold lives in `mobile/`.
- The D1 schema models stages, presence, now playing, proposals, and setlists.
- `scripts/seed.ts` loads seven Outside Lands stages and 49 Friday lineup slots.
- `scripts/simulate.ts` creates deterministic recent crowd-presence records.
- `scripts/reseed.ts` resets seed and simulation state together.
- Stage 2 logic and Stage 3 product UI are intentionally not implemented yet.

## Verification

- `npm run lint` validates the root application.
- `npm run test:stage1` verifies seven stages, 49 lineup slots, and simulated
  presence across all seven stages.
- `npm run mobile:check` type-checks the Expo application.

## Memory Maintenance

- Record only facts verified from repository files, tests, or explicit user
  decisions.
- Do not store secrets, credentials, guesses, temporary debugging notes, or
  completed-task narration.
- Update or remove stale facts when the implementation changes.
