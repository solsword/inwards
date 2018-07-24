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
  // insets a single inlay in the middle of it all. Not necessarily traversable
  // from side to side, but does allow dropping from above to either side. No
  // access from the bottom.
  function (wld, pane) {
    let constraints = pane.params.constraints || {};
    if (constraints.routes) {
      for (let r of constraints.routes) {
        let st = world.route_start(r);
        let ed = world.route_end(r);
        if (route_depth(r) <= 0) {
          return false;
        }
        if (
          (st[0] == "bot" || ed[0] == "bot" || ed[0] == "top")
       || (
            (st[0] == "left" || st[0] == "right")
         && (st[1] > PLAINS_MAX_SKY)
          )
       || (
            (ed[0] == "left" || ed[0] == "right")
         && (ed[1] > PLAINS_MAX_SKY)
          )
       || (route_hspan(r) > PANE_SIZE/4)
        ) {
          return false;
        }
      }
    }
    return true;
  },
  function (wld, pane) {
    let seed = pane.params.seed >>> 0;
    if (seed == undefined) { seed = 17; }

    let left_elevation = undefined;
    let right_elevation = undefined;
    let fall_left = 0;
    let fall_right = world.PANE_SIZE - 1;
    let constraints = pane.params.constraints || {};
    if (constraints.routes) {
      for (let r of constraints.routes) {
        let st = world.route_start(r);
        let ed = world.route_end(r);
        let left_bot = undefined;
        let right_bot = undefined;
        if (st[0] == "left") {
          left_bot = Math.floor(st[1] + world.route_width(r)/2);
        }
        if (ed[0] == "left") {
          left_bot = Math.floor(ed[1] + world.route_width(r)/2);
        }
        if (st[0] == "right") {
          right_bot = Math.floor(st[1] + world.route_width(r)/2);
        }
        if (ed[0] == "right") {
          right_bot = Math.floor(ed[1] + world.route_width(r)/2);
        }
        if (
          left_bot != undefined
       && (left_elevation == undefined || left_elevation < left_bot)
        ) {
          left_elevation = left_bot;
        }
        if (
          right_bot != undefined
       && (right_elevation == undefined || right_elevation < right_bot)
        ) {
          right_elevation = right_bot;
        }
        let left = Math.min(
          world.route_coords(r, "start")[0],
          world.route_coords(r, "end")[0]
        );
        let right = Math.max(
          world.route_coords(r, "start")[0],
          world.route_coords(r, "end")[0]
        );
        top_left = (
          (st[0] == "top" || ed[0] == "top")
       && (st[0] == "left" || ed[0] == "left")
        );
        top_right = (
          (st[0] == "top" || ed[0] == "top")
       && (st[0] == "right" || ed[0] == "right")
        );
        if (top_left && fall_left < right) {
          fall_left = right;
        }
        if (top_right && fall_right > left) {
          fall_right = left;
        }
      }
    }
    if (left_elevation == undefined) {
      left_elevation = (
        PLAINS_MIN_SKY
      + (seed % (PLAINS_MAX_SKY - 1 - PLAINS_MIN_SKY))
      );
      seed = rng.next(seed);
    }
    if (right_elevation == undefined) {
      right_elevation = (
        PLAINS_MIN_SKY
      + (seed % (PLAINS_MAX_SKY - 1 - PLAINS_MIN_SKY))
      );
      seed = rng.next(seed);
    }
    left_elevation += seed % 2;
    seed = rng.next(seed);
    right_elevation += seed % 2;
    seed = rng.next(seed);

    let available = fall_right - fall_left - 2;
    let isizei = 0;
    if (available >= 12) {
      isizei = 0;
    } else {
      isizei = 1;
    }
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
    let sr_width = [2, 3, 4][isizei];
    let anchor = fall_left + 1 + (seed % (fall_right - 1 - isize - fall_left));
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
      elev += PLAINS_UNDULATION * ut * ustr * Math.sin(t + useed);
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
    let subroutes = [
      world.make_route(
        "left",
        (a_elev - ipos[1]) * isf,
        "right",
        (ae_elev - ipos[1]) * isf,
        sr_width,
        3
      ),
      world.make_route(
        "right",
        (ae_elev - ipos[1]) * isf,
        "left",
        (a_elev - ipos[1]) * isf,
        sr_width,
        3
      ),
    ]
    // TODO: Inheritance of route constraints!
    let sub = world.create_pane(
      wld,
      {
        "seed": rng.sub_seed(pane.params.seed, ipos),
        "constraints": {
          "routes": subroutes
        }
      },
      pane.zone, // same zone (TODO: always?)
      undefined // generate a new id (TODO: always?)
    );

    console.log([pane, ipos, sub.id, isize]);
    world.inset_pane(pane, ipos, wld.panes[sub.id], isize);
  }
]

// TODO: DEBUG!
T.foothills.hirls = T.plains.outskirts;
T.forest.trees = T.plains.outskirts;
T.upper_caverns.cave = T.plains.outskirts;
