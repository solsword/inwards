// rng.js
// Random number generation interface

export function next(seed) {
  // TODO
  return seed + 47;
}

export function sub_seed(pane_seed, ipos) {
  // TODO
  return pane_seed + ipos[0] + ipos[1];
}
