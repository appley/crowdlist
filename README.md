# CrowdList

**The Outside Lands map, alive.**

CrowdList is a map-first, OpenAI-powered live activity layer for Outside Lands,
built for OutsideLLMS 2026. It is published as an **OpenAI Site** and opened from
the Outside Lands app's Experiences gallery.

## Shipped experience

V1 ships one complete loop:

- Open directly onto the official 2026 patron map.
- See seven stages inside a deterministic, moving festival activity portrait.
- Watch a clearly labeled simulated baseline flow along park paths while live
  community reports override the affected stage in realtime.
- Tap a stage for JamBase-linked `now` and `next` context.
- Locate yourself through browser geolocation or a labeled demo location.
- When explicitly located on the grounds, contribute only one coarse live cell
  for two minutes; exact coordinates and movement history are never stored.
- Submit a quick fan observation and watch the map update in realtime.
- Use OpenAI to turn optional natural-language detail into a validated live
  signal; chip-only reporting still works without AI.
- Optionally identify the song playing at a selected stage from a short mic
  sample, then confirm the shared candidate. Two independent fans crowd-verify
  the current song; this secondary flow never blocks the map or fixture demo.

The map is the primary interface. CrowdList does not recreate the official
lineup, schedule planner, favorites, alerts, directory, policies, or ticketing.

## Later phases

V2 may add recommendations, a secondary Ask CrowdList sheet, grounds routing,
preferences, and crowd-verified setlists built from recognition results. These
are deliberately excluded from the first build.

## Stack

- An OpenAI Sites-compatible React and TypeScript project
- MapLibre GL JS drawing Golden Gate Park from OpenStreetMap geometry, colored
  and labeled after the official patron map rather than rasterizing it
- Krish's tested CrowdSim engine, adapted to the official seven-stage geometry:
  8,000 seeded agents move over a reduced 207-node OSM path graph and aggregate
  into H3 cells with a five-contributor privacy floor. The resulting 24-frame,
  134 KB portrait ships instead of running the simulation on each fan's phone
- Convex as the external backend for reports, stage pulses, OpenAI actions, and
  demo state
- JamBase REST API imported and cached server-side
- OpenAI structured output for optional report interpretation
- ACRCloud Identification API for optional, stage-scoped song recognition

OpenAI Sites is the mandatory hosting and submission surface. Convex is an
external service, not a replacement deployment target.

## Optional song recognition

Create an ACRCloud Audio & Video Recognition project with the ACRCloud Music
bucket and **Recorded Audio** source, then add its host and credentials to the
Convex deployment:

```sh
bunx convex env set ACRCLOUD_HOST identify-us-west-2.acrcloud.com
bunx convex env set ACRCLOUD_ACCESS_KEY your-project-access-key
bunx convex env set ACRCLOUD_ACCESS_SECRET your-project-access-secret
```

Use the exact host shown by the ACRCloud project; the value above is only an
example. The browser records at most 10 seconds after an explicit tap, sends the
sample through a Convex server action, and immediately discards the local clip.
The secret is used only server-side to sign the multipart identification request.
Without all three values, the UI reports that recognition is unavailable and the
rest of CrowdList continues normally.

Protocol details follow ACRCloud's official
[Identification API](https://docs.acrcloud.com/reference/identification-api/identification-api),
[music-recognition setup](https://docs.acrcloud.com/tutorials/recognize-music),
and [error codes](https://docs.acrcloud.com/sdk-reference/error-codes).

## Specification

See the one-shot [V1 product and build specification](docs/product-spec.md).

## Status

Hackathon prototype — implemented, tested, and configured for OpenAI Sites.

## Local development

```sh
bun install
cp .env.example .env.local
bunx convex dev --once
bun run dev
```

Use `?fixture=1&demo=1` for the deterministic, credential-independent demo.
Add `?nomap=1` to force the text-only stage list that browsers without WebGL
receive automatically.

The park basemap is generated, not hand-drawn. `node scripts/build-basemap.mjs`
rebuilds `data/ol26/ggp-base.json` from OpenStreetMap, and
`node scripts/build-zones.mjs` rebuilds the festival zone polygons and checks
that every stage point still sits inside the zone its sheet names. Both are
build-time only; the app ships the generated files.
`bun run activity:build` deterministically regenerates the simulated activity
portrait. `scripts/import-crowdsim-graph.mjs` records how the official stage
geometry was cross-walked onto the `krish-dev` CrowdSim path graph. Every
visible cell represents at least five simulated contributors, and the UI always
identifies the portrait as an estimate rather than measurement.
Run `bun run check` before publishing. Server secrets belong in the Convex
deployment; only `VITE_CONVEX_URL` is supplied to the Sites build.
