# Project Memory

This file contains durable, verified context for future work. Keep it concise
and current. Update existing sections instead of appending a task diary.

## Product

- **Name:** CrowdList.
- **Purpose:** A live crowd heatmap and real-time setlist experience for music
  festivals.
- **Origin:** Built for the Outside Lands hackathon.
- **Current status:** Early, evolving hackathon prototype.

## Documented Behavior

- Shows crowd density around festival stages in real time.
- Shows the current song at each stage.
- Maintains a rolling live setlist and cached song history for each stage.
- Song identification combines a music-recognition API with human input.
- A song is posted only after it passes a human-agreement threshold.

## Documented Technology

- Expo with React Native and TypeScript.
- `expo-location` for location permission requested at sign-in.
- `expo-av` for audio clip capture.
- `react-native-maps` for the map and heatmap.
- Firebase is named as the backend/realtime service; the README's parenthetical
  detail is currently truncated.
- AudD for music recognition.

## Repository State

- The repository is currently documentation-only: `.gitignore`, `README.md`,
  `AGENTS.md`, and this file.
- No application source, package manifest, or test suite is present yet.
- Active development is intended to happen on the `krish-dev` branch.

## Documented Roadmap

- Rolling setlist accuracy with weighted, abuse-resistant voting.
- Cross-stage recommendations and notifications (the README entry is currently
  truncated).
- Real user accounts and offline support.

## Memory Maintenance

- Record only facts verified from repository files, tests, or explicit user
  decisions.
- Do not store secrets, credentials, guesses, temporary debugging notes, or
  completed-task narration.
- Update or remove stale facts when the implementation changes.
