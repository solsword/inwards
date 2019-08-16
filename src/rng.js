// rng.js
// Random number generation interface

export function next(x) {
  // Simple linear feedback shift register copied from anarchy.js lfsr function
  let lsb = x & 1;
  return (x >>> 1) ^ (0x80200003 * lsb); // 32, 22, 2, 1
}

export function sub_seed(pane_seed, ipos) {
  // TODO
  return pane_seed + ipos[0] + ipos[1];
}

export var FLIP_RESOLUTION = 1024*1024*1024;

export function flip(seed, p) {
  // Flips a coin, returning true with probability p. The seed should be
  // advanced afterwards. Resolution is 1/FLIP_RESOLUTION.
  let r = next(next(seed + FLIP_RESOLUTION/2.483));
  let t = p * FLIP_RESOLUTION;
  return (((r % FLIP_RESOLUTION) + FLIP_RESOLUTION) % FLIP_RESOLUTION) < t;
}

export function select(min, max, seed) {
  // Selects an integer at random between min and max (inclusive). The given
  // seed should be advanced afterwards.
  let n = max - min + 1;
  let pick = ((seed % n) + n) % n;
  return min + pick;
}

export function choice(array, seed) {
  // Picks an item from an array. Seed should be advanced afterwards.
  return array[select(0, array.length - 1, seed)];
}

export var UNIFORM_RESOLUTION = 1732<<23;

export function uniform(seed) {
  // Generates a random floating-point number evenly distributed between 0
  // (inclusive) and 1 (exclusive).
  let r = next(seed + UNIFORM_RESOLUTION/4.81293);
  return (r % UNIFORM_RESOLUTION) / UNIFORM_RESOLUTION;
}
