// blocks.js
// Block definitions & data

export var BLOCKS = [
  { "id": "chaos", "color": "#500", "accent": "#300" },
  { "id": "air", "color": "#fff", "accent": "#eef" },
  { "id": "dirt", "color": "#730", "accent": "#620" },
  { "id": "rock", "color": "#999", "accent": "#888" },
  { "id": "smooth_rock", "color": "#777", "accent": "#66" },
  { "id": "ice", "color": "#ccf", "accent": "#aaf" },
  { "id": "trunk", "color": "#b70", "accent": "#940" },
  { "id": "branches", "color": "#c80", "accent": "#a50" },
  { "id": "leaves", "color": "#191", "accent": "#3b2" },
  { "id": "water", "color": "#44b", "accent": "#008" },
  { "id": "点滅㈠", "color": "#185", "accent": "#3d7" },
  { "id": "点滅㈡", "color": "#aec", "accent": "#7ea" },
  { "id": "点滅㈢", "color": "#cfe", "accent": "#8fb" },
];

export var CHAOS = 0;
export var AIR = 1;
export var DIRT = 2;
export var ROCK = 3;

export function by_id(bid) {
  for (let i = 0; i < BLOCKS.length; ++i) {
    if (BLOCKS[i].id == bid) {
      return i;
    }
  }
  return undefined;
}

export var SOLID = {
  "dirt": true,
  "rock": true,
  "smooth_rock": true,
  "ice": true,
  "点滅㈠": true,
}

export var CLIMABLE = {
  "trunk": true,
  "branches": true,
  "leaves": true,
}

export var LIQUID = {
  "water": true,
}

export var SMOOTH = {
  "smooth_rock": true,
  "ice": true,
}

export var SLIPPERY = {
  "ice": true,
}

export function color(bid) { return BLOCKS[bid].color; }
export function accent_color(bid) { return BLOCKS[bid].accent; }
export function name(bid) { return BLOCKS[bid].id; }

export function is_solid(bid) {
  return SOLID[BLOCKS[bid].id] || false;
}

export function is_climable(bid) {
  return CLIMABLE[BLOCKS[bid].id] || false;
}

export function is_liquid(bid) {
  return LIQUID[BLOCKS[bid].id] || false;
}

export function is_smooth(bid) {
  return SMOOTH[BLOCKS[bid].id] || false;
}

export function is_slippery(bid) {
  return SLIPPERY[BLOCKS[bid].id] || false;
}
