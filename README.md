# CrowdList

**Live crowd heatmap and crowd-verified setlists for music festivals.**
Built at OutsideLLMS 2026 for Outside Lands.

---

## The problem

At a festival with six stages you are always making the same two decisions blind: *where is it too packed right now*, and *what is actually playing over there*.

A schedule can't answer either. It tells you who is booked for the hour. It doesn't tell you the set started twenty minutes late, that the last three songs were the deep cuts you came for, or that the walk to Sutro is currently a wall of people.

CrowdList makes the map live.

## What it does

**🗺️ Crowd heatmap** — how packed every stage is, right now, so you know where the energy is and where the lines aren't.

**🎵 Now Playing** — the song on at each stage this minute, not the artist scheduled for this hour.

**📜 Live setlist** — a rolling record of what's played, per stage, scrollable back through the set you missed.

**🤖 Concierge** — ask it where to go next and it answers from live crowd state, real set times, and what's actually playing.

## How song detection works

Open-world music recognition does not survive a festival. Stage bleed puts two songs in one microphone. Crowd noise buries the signal. DJ sets are edits and transitions no fingerprint database holds. Unreleased material returns nothing at all.

**So we never do open-world recognition. We do constrained inference over a candidate set.**

At any moment the space of songs that could be playing on a given stage is small and knowable:

1. **JamBase tells us who is on that stage right now** — normalized lineup and set times.
2. **setlist.fm tells us what they play** — recent tour setlists narrow an artist to roughly 20–40 live songs. This is a frequency count over past shows, not a trained model.
3. **That becomes a prior.** A fingerprint match, scattered human input, and a 30-song candidate list, with songs already played this set excluded, is a tractable inference problem where open-world ID is not.

A model arbitrates between those signals and scores confidence. **It never publishes on its own.** A track posts to the setlist only once human agreement clears threshold — the crowd is the accuracy floor, the model just breaks ties.

The people standing in front of the speakers are better sensors than any API. The threshold is what turns their scattered input into something worth publishing.

## Stack

| Layer | Choice |
|---|---|
| Host & deploy | **ChatGPT Sites** |
| Realtime backend | **Convex** — reactive queries, no polling |
| Lineup & set times | **JamBase v3 API + MCP server** — stages, schedule, matched artist IDs |
| Setlist history | setlist.fm (keyed by MusicBrainz MBID) |
| Inference | **OpenAI** — resolver with structured outputs, function-calling concierge |
| Fingerprinting | ACRCloud |
| Map | MapLibre GL JS |
| Client | TypeScript, Geolocation API, MediaRecorder |

Everything runs in the browser. No install — scan a QR at the gate and you're in.

## Privacy

Location places you at a stage and nothing else. Pings are aggregated into density buckets **before** they are written; individual traces are never stored. Mic access is per-clip and prompted at the moment of capture, never held open.

## Status

🚧 Hackathon prototype, built in one day.

Crowd density is seeded from historical festival patterns so the map is populated without a live crowd. Live capture, voting, and setlist resolution all work — they just need a few hundred people standing in a field.

## Roadmap

- Weighted, abuse-resistant voting so a handful of users can't push a false track
- Rolling per-stage accuracy scoring
- Cross-stage recommendations and push when a tracked artist starts
- Voice mode via the Realtime API, because typing at a festival is the wrong interface
- Offline support for dead zones on site
- Setlist export back to artists and live-music databases

## Built at

OutsideLLMS 2026 · One-day Music & AI Buildathon · San Francisco · August 2, 2026
