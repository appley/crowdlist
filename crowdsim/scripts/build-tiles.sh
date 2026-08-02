#!/usr/bin/env bash
set -euo pipefail

mkdir -p public/tiles
pmtiles extract \
  https://build.protomaps.com/20260720.pmtiles \
  public/tiles/outside-lands.pmtiles \
  --bbox=-122.511,37.763,-122.474,37.775 \
  --maxzoom=15
pmtiles verify public/tiles/outside-lands.pmtiles
