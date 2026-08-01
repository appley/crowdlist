# CrowdList

**Live crowd heatmap + real-time setlists for music festivals.**
Built for the Outside Lands hackathon.

## What it does

CrowdList turns a festival map into a living picture of where the crowds are and
what's playing right now:

- **🗺️ Crowd heatmap** — see how packed every stage is in real time, so you know
  where the energy is (and where the lines aren't).
- **🎵 Now Playing** — the song currently on at each stage, identified by a mix of
  music-recognition and the crowd itself.
- **📜 Live setlist** — a rolling list of what's playing plus a cached history of
  everything a stage has already played.

## How song detection works

A song is identified by combining a **music-recognition API** with **human input**
(people confirming or entering the track). A song is only posted once it passes a
**human-agreement threshold**, keeping the setlist accurate and crowd-verified.

## Stack

- **App:** Expo (React Native) + TypeScript
- **Location:** `expo-location` (permission requested on sign-in)
- **Audio:** `expo-av` for capturing clips to identify
- **Map / heatmap:** `react-native-maps`
- **Backend / realtime:** Firebase (Fire
- **Music recognition:** AudD

## Status

🚧 Hackathon prototype — early and evolving.

## Roadmap (V2)

- Rolling setlist accuracy + weighted, abuse-resistant voting
- Cross-stage recommendations and notifi
- Real user accounts and offline support   
