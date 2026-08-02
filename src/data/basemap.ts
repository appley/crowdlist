import type { FeatureCollection } from "geojson";
import basemapText from "../../data/ol26/ggp-base.json?raw";

/**
 * Golden Gate Park drawn from OpenStreetMap geometry (© OpenStreetMap
 * contributors, ODbL). Bundled rather than fetched so the map still draws when
 * the network is hostile and so it never depends on the deployment's base path.
 */
export const BASEMAP_GEOJSON = JSON.parse(basemapText) as FeatureCollection;
