// blocks.js
// Block definitions & data

export var BLOCKS = [
  { "id": "chaos", "color": "#f99", "accent": "#700" },
  { "id": "air", "color": "#fff", "accent": "#fff" },
  { "id": "dirt", "color": "#730", "accent": "#a80" },
  { "id": "rock", "color": "#999", "accent": "#bbb" },
  { "id": "smooth_rock", "color": "#777", "accent": "#999" },
  { "id": "ice", "color": "#aaf", "accent": "#ccf" },
  { "id": "trunk", "color": "#940", "accent": "#b70" },
  { "id": "branches", "color": "#940", "accent": "#b70" },
  { "id": "leaves", "color": "#3b2", "accent": "#191" },
  { "id": "water", "color": "#008", "accent": "#44b" },
];

export var CHAOS = 0;
export var AIR = 1;
export var DIRT = 2;

export var SOLID = {
  "dirt": true,
  "rock": true,
  "smooth_rock": true,
  "ice": true,
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
