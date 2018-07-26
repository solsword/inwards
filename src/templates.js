// templates.js
// World generation templates.

import * as blocks from "./blocks";
import * as world from "./world";
import * as rng from "./rng";
import * as biomes from "./biomes";


export var T = {};

for (let b of Object.keys(biomes.BIOMES)) {
  T[b] = {};
}

T.plains.outskirts = [
  // A simple template that fills the sky with air, the ground with dirt, and
  // insets a single inlay in the middle of it all. Not directly traversable
  // from side to side.
  function (wld, pane) {
    let constraints = pane.params.constraints || {};
    if (constraints.hasOwnProperty("traverse_depth")) {
      if (constraints.traverse_depth < 1) {
        return false;
      }
    }
    return true;
  },
  function (wld, pane) {
    let seed = pane.params.seed >>> 0;
    if (seed == undefined) { seed = 17; }

    let constraints = pane.params.constraints || {};
    let left_elevation = constraints.left_elevation;
    let right_elevation = constraints.right_elevation;
    let tdc = constraints.traverse_depth;
    if (left_elevation == undefined) {
      left_elevation = (
        biomes.PLAINS_MIN_SKY
      + (seed % (biomes.PLAINS_MAX_SKY - 1 - biomes.PLAINS_MIN_SKY))
      );
      seed = rng.next(seed);
    }
    if (right_elevation == undefined) {
      right_elevation = (
        biomes.PLAINS_MIN_SKY
      + (seed % (biomes.PLAINS_MAX_SKY - 1 - biomes.PLAINS_MIN_SKY))
      );
      seed = rng.next(seed);
    }
    left_elevation += seed % 2;
    seed = rng.next(seed);
    right_elevation += seed % 2;
    seed = rng.next(seed);

    let available = 14;
    let isizei = 0;
    seed = rng.next(seed);
    if (seed % 2) {
      isizei += 1;
    }
    seed = rng.next(seed);
    if (isizei < 2 && seed % 3 == 0) {
      isizei += 1;
    }
    seed = rng.next(seed);
    let isize = [12, 8, 6][isizei];
    let anchor = 6 + (seed % (13 - isize));
    seed = rng.next(seed);
    let a_elev = undefined;
    let ae_elev = undefined;

    world.fill_pane(pane, blocks.AIR);
    let upper = Math.min(left_elevation, right_elevation);
    let useed = seed/10;
    seed = rng.next(seed);
    let ustr = (seed % 100) / 100;
    seed = rng.next(seed);
    for (let x = 0; x < world.PANE_SIZE; ++x)  {
      let t = x / (world.PANE_SIZE - 1);
      let elev = left_elevation * (1 - t) + right_elevation * t;
      let ut = 0.5 - Math.abs(t - 0.5);
      elev += biomes.PLAINS_UNDULATION * ut * ustr * Math.sin(t + useed);
      elev = Math.floor(elev);
      if (x == anchor) {
        a_elev = elev;
      } else if (x == anchor + isize) {
        ae_elev = elev;
      }
      for (let y = elev; y < world.PANE_SIZE; ++y) {
        world.set_block(pane, [x, y], blocks.DIRT);
      }
    }

    let jut = Math.floor(isize/2 + (seed % isize)/4);
    seed = rng.next(seed);

    let ipos = [
      anchor,
      Math.min(a_elev, ae_elev) - jut
    ];
    let isf = world.PANE_SIZE / isize;
    let params = {
      "seed": rng.sub_seed(pane.params.seed, ipos),
      "constraints": {
        "left_elevation": a_elev,
        "right_elevation": ae_elev,
      }
    }
    if (tdc != undefined && tdc > 0) {
      params.constraints.traverse_depth = tdc - 1;
    }
    let sub = world.create_pane(
      wld,
      params,
      pane.zone, // same zone (TODO: always?)
      undefined // generate a new id (TODO: always?)
    );

    //console.log([pane, ipos, sub.id, isize]);
    world.inset_pane(pane, ipos, wld.panes[sub.id], isize);
  }
]

// TODO: DEBUG!
T.foothills.hirls = T.plains.outskirts;
T.forest.trees = T.plains.outskirts;
T.upper_caverns.cave = T.plains.outskirts;
