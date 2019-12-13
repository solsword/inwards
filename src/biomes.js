// biomes.js
// Biome data.

export var PLAINS_MIN_SKY = 12;
export var PLAINS_MAX_SKY = 18;
export var PLAINS_UNDULATION = 2;

export var BIOMES = {
  "sky": {},
  "plains": {},
  "desert": {},
  "foothills": {},
  "peaks": {},
  "forest": {},
  "great_tree": {},
  "upper_caverns": {},
  "lower_caverns": {},
  "underground_river": {},
  "river": {},
  "ocean": {},
  "village": {},
  "city": {},
}

export var START_BIOMES = [
  "plains",
  "foothills",
  "forest",
  "upper_caverns",
];

// Connectivity structure of the different biomes. Note that it's not fully
// symmetric.
export var BIOME_ADJACENCY = {
  "sky": new Set([
    "plains",
    "desert",
    "foothills",
    "peaks",
    "forest",
    "great_tree",
    "river",
    "ocean",
    "village",
    "city"
  ]),
  "plains": new Set([
    "sky",
    "desert",
    "foothills",
    "forest",
    "upper_caverns",
    "river",
    "ocean",
    "village"
  ]),
  "desert": new Set([
    "sky",
    "plains",
    "foothills",
    "upper_caverns",
    "river",
    "ocean"
  ]),
  "foothills": new Set([
    "sky",
    "plains",
    "desert",
    "peaks",
    "forest",
    "upper_caverns",
    "river",
    "village",
  ]),
  "peaks": new Set([
    "sky",
    "foothills"
  ]),
  "forest": new Set([
    "sky",
    "plains",
    "foothills",
    "great_tree",
    "upper_caverns",
    "river",
    "ocean"
  ]),
  "great_tree": new Set([
    "sky",
    "forest"
  ]),
  "upper_caverns": new Set([
    "plains",
    "desert",
    "foothills",
    "forest",
    "lower_caverns",
    "underground_river",
    "city"
  ]),
  "lower_caverns": new Set([
    "upper_caverns",
    "underground_river"
  ]),
  "underground_river": new Set([
    "upper_caverns",
    "lower_caverns",
    "river",
  ]),
  "river": new Set([
    "sky",
    "plains",
    "desert",
    "foothills",
    "forest",
    "underground_river",
    "ocean",
    "village",
    "city"
  ]),
  "ocean": new Set([
    "plains",
    "desert",
    "river"
  ]),
  "village": new Set([
    "sky",
    "plains",
    "foothills",
    "river",
    "city"
  ]),
  "city": new Set([
    "sky",
    "upper_caverns",
    "river",
    "village"
  ]),
};
