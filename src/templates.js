// templates.js
// World generation templates.

import * as blocks from "./blocks";
import * as world from "./world";
import * as rng from "./rng";
import * as biomes from "./biomes";
import * as bsp from "./bsp";


export var T = {};

for (let b of Object.keys(biomes.BIOMES)) {
  T[b] = {};
}

export function excavate_bsp(pane, partition, block, respect) {
  // Given a pane and a binary space partition for that pane, places the given
  // block along each edge of the BSP, avoiding blocks for which the optional
  // respect function returns true.
  for (let fr of Object.keys(partition.edges)) {
    let fr_node = partition.nodes[fr];
    let start = bsp.node_centerish(partition, fr_node);
    for (let to of partition.edges[fr]) {
      let to_node = partition.nodes[to];
      let end = bsp.node_centerish(partition, to_node);
      //world.walk_randomly(pane, start, end, block, respect);
      world.walk_directly(pane, start, end, block, respect);
    }
  }
}

export function show_bsp(pane, partition, blocks) {
  // Debugging function to draw each node of the BSP using a different block.
  let i = 0;
  for (let nid of Object.keys(partition.nodes)) {
    let node = partition.nodes[nid]
    let block = blocks[i];
    i = (i + 1) % blocks.length;
    for (let x = node.left; x <= node.right; ++x) {
      for (let y = node.top; y <= node.bottom; ++y) {
        world.set_block(pane, [x, y], block);
      }
    }
  }
}

export function random_inlay_size(seed) {
  // Picks a random size for an inlay; one of 12, 8, or 6 blocks with a bias
  // towards smaller sizes. The given seed should be advanced afterwards.
  let isizei = 0;
  seed = rng.next(seed + 38928341);
  if (rng.flip(seed, 0.5)) {
    isizei += 1;
  }
  seed = rng.next(seed);
  if (isizei < 2 && rng.flip(seed, 0.33)) {
    isizei += 1;
  }
  return [12, 8, 6][isizei];
}

export function random_small_inlay_size(seed) {
  // Picks a random size for an inlay; either 8 or 6 blocks. The given seed
  // should be advanced afterwards.
  if (rng.flip(seed, 0.5)) {
    return 6;
  } else {
    return 8;
  }
}


T.plains.outskirts = {
  // A simple template that fills the sky with air, the ground with dirt, and
  // insets a single inlay in the middle of it all. Not directly traversable
  // from side to side.
  'applicable_to': function (wld, pane) {
    let constraints = pane.params.constraints || {};
    if (constraints.hasOwnProperty("traverse_depth")) {
      if (constraints.traverse_depth < 1) {
        return false;
      }
    }
    if (constraints.hasOwnProperty("entrances")) {
      for (let ent of constraints.entrances) {
        if (ent[0] == "bottom") {
          return false; // can't deal with bottom entrances
        }
      }
    }
    return true;
  },
  'generate': function (wld, pane) {
    let seed = pane.params.seed >>> 0;
    if (seed == undefined) { seed = 17; }

    let constraints = pane.params.constraints || {};
    let entrances = constraints.entrances;
    let left_elevation = constraints.left_elevation;
    let right_elevation = constraints.right_elevation;
    let tdc = constraints.traverse_depth;
    // Pull elevation to match lowest entrance
    if (entrances != undefined) {
      for (let ent of entrances) {
        if (
          ent[0] == "left"
       && (left_elevation == undefined || ent[1] > left_elevation)
        ) {
          left_elevation = ent[1];
        } else if (
          ent[0] == "right"
       && (right_elevation == undefined || ent[1] > right_elevation)
        ) {
          right_elevation = ent[1];
        } else if (
          ent[0] == "bottom"
        ) {
          console.warn("Plains outskirts cannot accomodate bottom entrance!");
        }
      }
    }
    // pick random elevations if unconstrained:
    if (left_elevation == undefined) {
      left_elevation = (
        biomes.PLAINS_MIN_SKY
      + rng.select(biomes.PLAINS_MIN_SKY, biomes.PLAINS_MAX_SKY, seed)
      );
      seed = rng.next(seed);
      if (right_elevation != undefined) {
        left_elevation = Math.floor((right_elevation + left_elevation)/2);
      }
    }
    if (right_elevation == undefined) {
      right_elevation = (
        biomes.PLAINS_MIN_SKY
      + rng.select(biomes.PLAINS_MIN_SKY, biomes.PLAINS_MAX_SKY, seed)
      );
      seed = rng.next(seed);
      if (left_elevation != undefined) {
        right_elevation = Math.floor((right_elevation + left_elevation)/2);
      }
    }

    // Randomize one more block (+/- 1 because % can be negative):
    left_elevation += seed % 2;
    seed = rng.next(seed);
    right_elevation += seed % 2;
    seed = rng.next(seed);

    // Enforce global constrains (softly):
    if (left_elevation < biomes.PLAINS_MIN_SKY) {
      left_elevation += 1;
    }

    if (right_elevation < biomes.PLAINS_MIN_SKY) {
      right_elevation += 1;
    }

    if (left_elevation > biomes.PLAINS_MAX_SKY) {
      left_elevation -= 1;
    }

    if (right_elevation > biomes.PLAINS_MAX_SKY) {
      right_elevation -= 1;
    }

    // Record elevations in pane parameters:
    pane.params.left_elevation = left_elevation;
    pane.params.right_elevation = right_elevation;

    // Pick size for inlay:
    let isize = random_inlay_size(seed);
    seed = rng.next(seed);

    // Pick horizontal anchor for inlay:
    let anchor = rng.select(6, 18 - isize, seed);
    seed = rng.next(seed);

    // Watch for actual elevation at start and end of inlay:
    let outer_left_elev = undefined;
    let outer_right_elev = undefined;

    // Draw sky and ground:
    world.fill_pane(pane, blocks.AIR);
    let upper = Math.min(left_elevation, right_elevation);
    let useed = seed/10;
    seed = rng.next(seed);
    let ustr = rng.uniform(seed);
    seed = rng.next(seed);
    for (let x = 0; x < world.PANE_SIZE; ++x)  {
      let t = x / (world.PANE_SIZE - 1);
      let elev = left_elevation * (1 - t) + right_elevation * t;
      let ut = 0.5 - Math.abs(t - 0.5);
      elev += biomes.PLAINS_UNDULATION * ut * ustr * Math.sin(t + useed);
      elev = Math.floor(elev);
      if (x == anchor) {
        outer_left_elev = elev;
      } else if (x == anchor + isize) {
        outer_right_elev = elev;
      }
      for (let y = elev; y < world.PANE_SIZE; ++y) {
        world.set_block(pane, [x, y], blocks.DIRT);
      }
    }

    // Decide final full position of inlay:
    let jut = rng.select(isize/2, Math.floor(isize*0.75), seed);
    seed = rng.next(seed);
    let ipos = [
      anchor,
      Math.min(outer_left_elev, outer_right_elev) - jut
    ];
    if (ipos[1] < 0) {
      ipos[1] = 0;
    }

    // Compute inner elevations to send as constraints:
    let isf = world.PANE_SIZE / isize;
    let inner_left_elev = (outer_left_elev - ipos[1]) * isf;
    let inner_right_elev = (outer_right_elev - ipos[1]) * isf;

    // Inlay parameters:
    let params = {
      "seed": rng.sub_seed(pane.params.seed, ipos),
      "constraints": {
        "left_elevation": inner_left_elev,
        "right_elevation": inner_right_elev,
      }
    }
    if (tdc != undefined && tdc > 0) {
      params.constraints.traverse_depth = tdc - 1;
    }

    // Create and inset inlay pane:
    let sub = world.create_pane(
      wld,
      params,
      pane.zone, // same zone (TODO: always?)
      undefined // generate a new id (TODO: always?)
    );
    world.inset_pane(pane, ipos, wld.panes[sub.id], isize);
  }
}

// TODO: Create these!
T.foothills.hills = T.plains.outskirts;
T.forest.trees = T.plains.outskirts;

T.upper_caverns.cave = {
  // A template that uses a binary space partition to place some rooms,
  // including an inlay, and digs tunnels between them.
  'applicable_to': function (wld, pane) {
    // TODO
    return true;
    /*
     * TODO: traversibility?
    let constraints = pane.params.constraints || {};
    if (constraints.hasOwnProperty("traverse_depth")) {
      if (constraints.traverse_depth < 1) {
        return false;
      }
    }
    return true;
    */
  },
  'generate': function (wld, pane) {
    let seed = pane.params.seed >>> 0;
    if (seed == undefined) { seed = 17; }

    let constraints = pane.params.constraints || {};
    let entrances = constraints.entrances;
    let tdc = constraints.traverse_depth;

    // Pick size for inlay:
    let isize = random_inlay_size(seed);
    seed = rng.next(seed);

    // Pick anchor position for inlay (1-block margin on all sides):
    let ax = rng.select(2, world.PANE_SIZE - isize - 2, seed);
    seed = rng.next(seed);
    let ay = rng.select(2, world.PANE_SIZE - isize - 2, seed);
    seed = rng.next(seed);
    let ipos = [ax, ay];

    // Fill with stone:
    world.fill_pane(pane, blocks.STONE);

    // Build and excavate BSP to carve tunnels:
    let minsize = rng.choice([4, 5, 6], seed);
    seed = rng.next(seed);
    let connectivity = rng.uniform(seed);
    seed = rng.next(seed);
    connectivity = Math.min(connectivity, rng.uniform(seed));
    seed = rng.next(seed);
    connectivity = (connectivity + 0.4)/2;
    let partition = bsp.bsp_graph(
      pane.params.seed + 192815,
      minsize,
      connectivity
    );
    /* Uncomment this to draw each BSP cell with a different block type * /
    show_bsp(
      pane,
      partition,
      [
        blocks.by_id("dirt"),
        blocks.by_id("bridge"),
        blocks.by_id("smooth_stone"),
        blocks.by_id("ice"),
        blocks.by_id("ice_bridge"),
        blocks.by_id("trunk"),
        blocks.by_id("branches"),
        blocks.by_id("leaves"),
        blocks.by_id("water"),
        blocks.by_id("brick")
      ]
    );
    // */
    excavate_bsp(pane, partition, blocks.AIR); // nothing to respect


    // Add a random entrance if we don't have any:
    if (entrances == undefined) {
      entrances = [ random_entrance(seed) ];
      seed = rng.next(seed);
    }

    // Excavate from each entrance to its graph node:
    for (let ent of entrances) {
      let epos = world.entrance_pos(ent);
      let node_id = bsp.lookup_pos(partition, epos);
      let node = partition.nodes[node_id];
      let center = bsp.node_centerish(partition, node);
      //world.walk_randomly(pane, epos, center, blocks.AIR);
      world.walk_randomly(pane, epos, center, blocks.AIR);
    }

    // Compute inlay entrances:
    let sub_entrances = deduce_inlay_entrances(pane, ipos, isize);
    if (sub_entrances.length == 0) {
      console.warn("No entrances deduced for cave inlay!", pane, ipos, isize);
    }

    // Inlay parameters:
    let params = {
      "seed": rng.sub_seed(pane.params.seed, ipos),
      "constraints": {
        "entrances": sub_entrances
      }
    }
    if (tdc != undefined && tdc > 0) {
      params.constraints.traverse_depth = tdc - 1;
    }

    // Create and inset inlay pane:
    let sub = world.create_pane(
      wld,
      params,
      pane.zone, // same zone (TODO: always?)
      undefined // generate a new id (TODO: always?)
    );
    world.inset_pane(pane, ipos, wld.panes[sub.id], isize);
  }
}

T.upper_caverns.branch_cave = {
  // Like cave, but includes two inlays.
  // TODO: Generalize # of inlays between 1 and 3.
  'applicable_to': function (wld, pane) {
    // TODO
    return true;
    /*
     * TODO: traversibility?
    let constraints = pane.params.constraints || {};
    if (constraints.hasOwnProperty("traverse_depth")) {
      if (constraints.traverse_depth < 1) {
        return false;
      }
    }
    return true;
    */
  },
  'generate': function (wld, pane) {
    let seed = pane.params.seed >>> 0;
    if (seed == undefined) { seed = 17; }

    let constraints = pane.params.constraints || {};
    let entrances = constraints.entrances;
    let tdc = constraints.traverse_depth;

    // Pick sizes for inlays:
    let isize1 = random_small_inlay_size(seed);
    seed = rng.next(seed);
    let isize2 = random_small_inlay_size(seed);
    seed = rng.next(seed);

    // Pick quadrants for both inlays:
    let q1 = rng.select(0, 3, seed);
    seed = rng.next(seed);
    let q2 = (q1 + rng.select(1, 3, seed)) % 4;
    seed = rng.next(seed);

    // Pick anchor position for each inlay within its quadrant (1-block margin
    // on all sides):
    let ipos1 = pick_pos_in_quadrant(q1, 1, isize1, seed);
    seed = rng.next(seed);
    let ipos2 = pick_pos_in_quadrant(q2, 1, isize2, seed);
    seed = rng.next(seed);

    // Fill with stone:
    world.fill_pane(pane, blocks.STONE);

    // Build and excavate BSP to carve tunnels:
    let minsize = rng.choice([4, 5, 6], seed);
    seed = rng.next(seed);
    let connectivity = rng.uniform(seed);
    seed = rng.next(seed);
    connectivity = Math.min(connectivity, rng.uniform(seed));
    seed = rng.next(seed);
    connectivity = (connectivity + 0.4)/2;
    let partition = bsp.bsp_graph(
      pane.params.seed + 192815,
      minsize,
      connectivity
    );
    /* Uncomment this to draw each BSP cell with a different block type * /
    show_bsp(
      pane,
      partition,
      [
        blocks.by_id("dirt"),
        blocks.by_id("bridge"),
        blocks.by_id("smooth_stone"),
        blocks.by_id("ice"),
        blocks.by_id("ice_bridge"),
        blocks.by_id("trunk"),
        blocks.by_id("branches"),
        blocks.by_id("leaves"),
        blocks.by_id("water"),
        blocks.by_id("brick")
      ]
    );
    // */
    excavate_bsp(pane, partition, blocks.AIR); // nothing to respect


    // Add a random entrance if we don't have any:
    if (entrances == undefined) {
      entrances = [ random_entrance(seed) ];
      seed = rng.next(seed);
    }

    // Excavate from each entrance to its graph node:
    for (let ent of entrances) {
      let epos = world.entrance_pos(ent);
      let node_id = bsp.lookup_pos(partition, epos);
      let node = partition.nodes[node_id];
      let center = bsp.node_centerish(partition, node);
      //world.walk_randomly(pane, epos, center, blocks.AIR);
      world.walk_randomly(pane, epos, center, blocks.AIR);
    }

    // Compute inlay entrances:
    let sub_entrances1 = deduce_inlay_entrances(pane, ipos1, isize1);
    if (sub_entrances1.length == 0) {
      console.warn(
        "No entrances deduced for cave inlay 1!",
        pane,
        ipos1,
        isize1
      );
    }
    let sub_entrances2 = deduce_inlay_entrances(pane, ipos2, isize2);
    if (sub_entrances2.length == 0) {
      console.warn(
        "No entrances deduced for cave inlay 2!",
        pane,
        ipos2,
        isize2
      );
    }

    // Inlay parameters:
    let params1 = {
      "seed": rng.sub_seed(pane.params.seed, ipos1),
      "constraints": {
        "entrances": sub_entrances1
      }
    }
    let params2 = {
      "seed": rng.sub_seed(pane.params.seed, ipos2),
      "constraints": {
        "entrances": sub_entrances2
      }
    }

    if (tdc != undefined && tdc > 0) {
      params1.constraints.traverse_depth = tdc - 1;
      params2.constraints.traverse_depth = tdc - 1;
    }

    // Create and inset inlay panes:
    let sub1 = world.create_pane(
      wld,
      params1,
      pane.zone, // same zone (TODO: always?)
      undefined // generate a new id (TODO: always?)
    );
    world.inset_pane(pane, ipos1, wld.panes[sub1.id], isize1);
    let sub2 = world.create_pane(
      wld,
      params2,
      pane.zone, // same zone (TODO: always?)
      undefined // generate a new id (TODO: always?)
    );
    world.inset_pane(pane, ipos2, wld.panes[sub2.id], isize2);
  }
}

export function deduce_inlay_entrances(pane, pos, size) {
  // Creates a list of entrance constraints based on where solid blocks are
  // adjacent to an inlay with the given size anchored at the given position.
  // Creates one entrance at the middle of each contiguous block of non-solid
  // blocks along each edge of the inlay.
  let entrances = [];
  let run_start = undefined;

  // top edge:
  let y = pos[1] - 1;
  if (y >= 0) { // otherwise no top entrances
    let x;
    for (x = pos[0]; x < pos[0] + size; ++x) {
      if (blocks.is_solid(world.block_at(pane, [x,  y]))) { // solid block
        if (run_start != undefined) { // we're in a run
          let middle = (run_start + x) / 2;
          let interior = Math.floor(
            (middle - pos[0]) * (world.PANE_SIZE / size)
          );
          entrances.push(["top", interior])
          run_start = undefined; // end of that run
        } // else nothing; wait for a run to start
      } else { // empty block
        if (run_start == undefined) {
          run_start = x;
        } // else nothing; wait for this run to end
      }
    }
    if (run_start != undefined) { // run that goes to edge
      let middle = (run_start + x) / 2;
      let interior = Math.floor((middle - pos[0]) * (world.PANE_SIZE / size));
      entrances.push(["top", interior]);
    }
  }
  run_start = undefined;

  // bottom edge:
  y = pos[1] + size;
  if (y <= world.PANE_SIZE - 1) { // otherwise no bottom entrances
    let run_start = undefined;
    let x;
    for (x = pos[0]; x < pos[0] + size; ++x) {
      if (blocks.is_solid(world.block_at(pane, [x,  y]))) { // solid block
        if (run_start != undefined) { // we're in a run
          let middle = (run_start + x) / 2;
          let interior = Math.floor(
            (middle - pos[0]) * (world.PANE_SIZE / size)
          );
          entrances.push(["bottom", interior])
          run_start = undefined; // end of that run
        } // else nothing; wait for a run to start
      } else { // empty block
        if (run_start == undefined) {
          run_start = x;
        } // else nothing; wait for this run to end
      }
    }
    if (run_start != undefined) { // run that goes to edge
      let middle = (run_start + x) / 2;
      let interior = Math.floor((middle - pos[0]) * (world.PANE_SIZE / size));
      entrances.push(["bottom", interior]);
    }
  }
  run_start = undefined;

  // left edge:
  let x = pos[0] - 1;
  if (x >= 0) { // otherwise no left entrances
    let run_start = undefined;
    let y;
    for (y = pos[1]; y < pos[1] + size; ++y) {
      if (blocks.is_solid(world.block_at(pane, [x,  y]))) { // solid block
        if (run_start != undefined) { // we're in a run
          let middle = (run_start + y) / 2;
          let interior = Math.floor(
            (middle - pos[1]) * (world.PANE_SIZE / size)
          );
          entrances.push(["left", interior])
          run_start = undefined; // end of that run
        } // else nothing; wait for a run to start
      } else { // empty block
        if (run_start == undefined) {
          run_start = y;
        } // else nothing; wait for this run to end
      }
    }
    if (run_start != undefined) { // run that goes to edge
      let middle = (run_start + y) / 2;
      let interior = Math.floor((middle - pos[1]) * (world.PANE_SIZE / size));
      entrances.push(["left", interior]);
    }
  }
  run_start = undefined;

  // right edge:
  x = pos[0] + size;
  if (x < world.PANE_SIZE - 1) { // otherwise no right entrances
    let run_start = undefined;
    let y;
    for (y = pos[1]; y < pos[1] + size; ++y) {
      if (blocks.is_solid(world.block_at(pane, [x,  y]))) { // solid block
        if (run_start != undefined) { // we're in a run
          let middle = (run_start + y) / 2;
          let interior = Math.floor(
            (middle - pos[1]) * (world.PANE_SIZE / size)
          );
          entrances.push(["right", interior])
          run_start = undefined; // end of that run
        } // else nothing; wait for a run to start
      } else { // empty block
        if (run_start == undefined) {
          run_start = y;
        } // else nothing; wait for this run to end
      }
    }
    if (run_start != undefined) { // run that goes to edge
      let middle = (run_start + y) / 2;
      let interior = Math.floor((middle - pos[1]) * (world.PANE_SIZE / size));
      entrances.push(["right", interior]);
    }
  }

  return entrances;
}

export function random_entrance(seed) {
  seed = rng.next(seed + 18294123);
  let side = rng.choice(["top", "bottom", "left", "right"], seed);
  seed = rng.next(seed);
  return [side, rng.select(0, world.PANE_SIZE - 1, seed)];
}

export function pick_pos_in_quadrant(quadrant, border, size, seed) {
  // Picks a random position in the given quadrant (reading order from top
  // left) with at least the given border size between the object and the edge
  // of the quadrant on all sides, for an object of the given size. The seed
  // should be advanced afterwards. Returns an [x, y] pair.

  // Scramble the local seed:
  seed ^= 927398749;

  // If the border + size is too big, ignore the size and always return the
  // upper-left-most position:
  if (border*2 + size > 12) {
    console.warn(
      "Asked to pick position in quadrant with border " + border + " and size "
    + size + " but there isn't room to do so! Respecting border but not size."
    );
    if (quadrant == 0) {
      return [border+1, border+1];
    } else if (quadrant == 1) {
      return [12 + border + 1, border + 1];
    } else if (quadrant == 2) {
      return [border + 1, 12 + border + 1];
    } else {
      return [12 + border + 1, 12 + border + 1];
    }
  }

  // Figure out (inclusive) bounds for this quadrant:
  let left, right, top, bottom;
  if (quadrant == 0) {
    left = border + 1;
    right = 12 - border - size;
    top = border + 1;
    bottom = 12 - border - size;
  } else if (quadrant == 1) {
    left = 12 + border + 1;
    right = 24 - border - size;
    top = border + 1;
    bottom = 12 - border - size;
  } else if (quadrant == 2) {
    left = border + 1;
    right = 12 - border - size;
    top = 12 + border + 1;
    bottom = 24 - border - size;
  } else {
    left = 12 + border + 1;
    right = 24 - border - size;
    top = 12 + border + 1;
    bottom = 24 - border - size;
  }

  // Pick random position given bounds:
  let x = rng.select(left, right, seed);
  seed = rng.next(seed);
  let y = rng.select(top, bottom, seed);

  return [x, y];
}
