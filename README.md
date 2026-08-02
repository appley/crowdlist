# CrowdList

**The Outside Lands map, alive.**

CrowdList is a map-first, OpenAI-powered live activity layer for Outside Lands,
built for OutsideLLMS 2026. It is published as an **OpenAI Site** and opened from
the Outside Lands app's Experiences gallery.

## V1

V1 ships one complete loop:

- Open directly onto the official 2026 patron map.
- See seven stages with seeded or live crowd-comfort and energy pulses.
- Tap a stage for JamBase-linked `now` and `next` context.
- Locate yourself through browser geolocation or a labeled demo location.
- Submit a quick fan observation and watch the map update in realtime.
- Use OpenAI to turn optional natural-language detail into a validated live
  signal; chip-only reporting still works without AI.

The map is the primary interface. CrowdList does not recreate the official
lineup, schedule planner, favorites, alerts, directory, policies, or ticketing.

## Later phases

V2 may add recommendations, a secondary Ask CrowdList sheet, grounds routing,
preferences, and song recognition feeding crowd-verified setlists. These are
deliberately excluded from the first build.

## Proposed stack

- An OpenAI Sites-compatible React and TypeScript project
- MapLibre GL JS with the official map PDF rendered as a georeferenced image
- Convex as the external backend for reports, stage pulses, OpenAI actions, and
  demo state
- JamBase REST API imported and cached server-side
- OpenAI structured output for optional report interpretation

OpenAI Sites is the mandatory hosting and submission surface. Convex is an
external service, not a replacement deployment target.

## Specification

See the one-shot [V1 product and build specification](docs/product-spec.md).

## Status

Hackathon prototype — V1 specification ready for implementation.
