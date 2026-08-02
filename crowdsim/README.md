# CrowdSim

CrowdSim is CrowdList's deterministic festival crowd simulator and scrubbable data portrait. It is a separate Vite + TypeScript module served at `/crowdsim/` by the main ChatGPT Sites app.

It serves four jobs from one codebase:

1. Cold-start estimates for festivals with no contributors yet.
2. Replayable load-test traffic with real set-change burst shape.
3. A convincing, clearly labeled demo dataset.
4. A post-event portrait that can render measured data without renderer changes.

## Run it

From the repository root, `npm run dev` builds CrowdSim and starts CrowdList. To work on the module alone, run `npm --prefix crowdsim run dev`.

The default configuration is seed `42`, 8,000 agents, a ten-hour day, 30-second decisions, 60-second density buckets, H3 resolution 11, and a k-anonymity floor of 5. Seed and agent count are available in the UI; the remaining defaults live in `src/data/schema.ts`.

## The contract

`src/data/schema.ts` is authoritative. Simulation emits `FestivalDay`; the renderer consumes `FestivalDay`. The renderer does not branch on whether data is simulated, measured, or hybrid, except to surface `meta.source` prominently.

The contract must remain byte-compatible with production aggregation. Renderer conveniences belong in transient render types, never in `FestivalDay`. Stage placement provenance remains in the authored input config because `Stage` intentionally has no convenience fields.

Every emitted density cell has at least five contributors. Simulated output is an estimate and must never be presented as measurement.

## Geometry and offline map

The cached OSM extract covers the central and western festival footprint. `scripts/build-graph.ts` produces the connected path graph; `scripts/validate-site.ts` fails on disconnected graphs, unreachable stages, or implausible path length. Stage positions are authored estimates because the official 2026 festival map was not published when this module was built.

The self-hosted PMTiles archive is clipped from the Protomaps July 20, 2026 build and verified with the PMTiles CLI. The simulator service worker precaches it for offline playback. The UI visibly credits OpenStreetMap contributors and Protomaps.

## Load testing

`data/export.ts` expands aggregate density into the production ping shape and can replay the full day into an ingest endpoint with time compression. Batches keep their original minute boundaries, so set-change spikes are preserved instead of flattened into an average.
