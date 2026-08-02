# CrowdList

**The Outside Lands map, alive.**

CrowdList is a map-first, OpenAI-powered live layer for the Outside Lands
festival. It is being designed for OutsideLLMS 2026 as a public mobile website
opened from the Outside Lands app's Experiences gallery.

## Product

CrowdList starts with the official patron map and adds information that a static
festival guide cannot provide:

- **Live crowd activity** — qualitative, time-decaying crowd comfort and energy
  around each stage.
- **Stage Pulse** — what is scheduled now and next, what fans are observing, and
  how fresh and trustworthy each signal is.
- **Festival movement** — interactive paths and stage-to-stage routes drawn over
  the familiar map.
- **Two-tap reports** — fast attendee contributions that visibly update the live
  map.
- **Optional intelligence** — compact Next Move suggestions and a secondary Ask
  CrowdList sheet powered by OpenAI. The map remains the primary interface.

JamBase supplies canonical event and artist context. CrowdList imports that data
server-side and layers live community observations on top.

## Product boundary

CrowdList extends the official Outside Lands app rather than recreating it. The
official app remains responsible for the full lineup, schedule planning,
official alerts, festival policies, tickets, food, amenities, and the Experiences
catalog. CrowdList focuses on the live spatial experience.

## Song recognition and setlists

Crowd-verified current songs and rolling setlists remain a planned expansion,
not a dependency for the hackathon demo. A dedicated music-recognition service
may contribute one signal, while independent fan agreement determines whether a
song becomes confirmed.

## Proposed stack

- **Site:** React / Next.js + TypeScript, delivered as a mobile-first PWA
- **Map:** MapLibre GL JS with the official map PDF as a georeferenced image
  layer and CrowdList GeoJSON overlays
- **Backend and realtime:** Firebase / Firestore
- **Festival data:** JamBase REST API, imported and cached server-side
- **AI:** OpenAI API with structured, validated outputs

## Specification

See the full [product and technical specification](docs/product-spec.md).

## Status

Hackathon prototype — specification phase.
