// Single source of truth for which maps are bundled in this offline build.
//
// The full map registry in Maps.gen.ts lists all 95 maps, but the offline
// Android APK only ships a subset of map .bin files to stay under the size
// budget. Maps that are listed but not bundled load as blank/broken, so the
// in-game map picker must show ONLY the maps in this list.
//
// IMPORTANT: keep this list in sync with the maps actually copied into the
// build (the KEEP list used when trimming static/_assets/maps). The ids here
// are GameMapType enum keys (the UpperCamelCase folder names).

import { GameMapName, MapInfo, maps } from "./Maps.gen";

export const shippedMapIds: readonly GameMapName[] = [
  // Originally shipped
  "Onion",
  "BosphorusStraits",
  "Pangaea",
  "DanishStraits",
  "Caucasus",
  "World",
  // Added in the featured build
  "Europe",
  "Asia",
  "Australia",
  "Japan",
  "Britannia",
  "BlackSea",
  "Mena",
  "GatewayToTheAtlantic",
  "Halkidiki",
  "Italia",
  "Korea",
  "Iceland",
  "NorthAmerica",
];

const shippedMapIdSet = new Set<GameMapName>(shippedMapIds);

export function isShippedMap(id: GameMapName): boolean {
  return shippedMapIdSet.has(id);
}

// The subset of the full map registry that is actually bundled in this build.
// Use this (instead of the full `maps`) anywhere the UI enumerates maps so the
// user can never select a map whose data is not present.
export const shippedMaps: readonly MapInfo[] = maps.filter((m) =>
  shippedMapIdSet.has(m.id),
);
