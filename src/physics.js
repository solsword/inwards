// physics.js
// Physics engine

import * as blocks from "./blocks";
import * as world from "./world";

// Milliseconds per block tick
export var BLOCK_TICK_DURATION = 1000;

// Cooldown in milliseconds before you can jump again
export var JUMP_COOLDOWN = 150;

// The size in both % of entity size and absolute blocks of the detection zone
// for entity-block adjacency
export const ADJACENCY_ZONE_SIZE = 0.15; // 15% of entity size
export const ADJACENCY_ZONE_MAX_SIZE = 0.25; // max 1/4 of a full block

export var BLOCK_PROGRESSIONS = {};
BLOCK_PROGRESSIONS[blocks.by_id("点滅㈠")] = blocks.by_id("点滅㈡");
BLOCK_PROGRESSIONS[blocks.by_id("点滅㈡")] = blocks.by_id("点滅㈢");
BLOCK_PROGRESSIONS[blocks.by_id("点滅㈢")] = blocks.by_id("点滅㈠");

// how deep (recursively) to tick stuff
export const TICK_DEPTH = 2;

// Modifies elapsed time to slow down in-game time relative to real time.
export const TIME_DILATION = 0.1;

// Gravity in blocks/millisecond
export const GRAVITY = 0.5 / 1000;

// Buoyancy in blocks/millisecond (of course that's not how it works)
export const BUOYANCY = 0.08 / 1000;

// Buoyancy for swimming non-fish
export const SWIMMER_BUOYANCY = 0.01 / 1000;

// Velocity cap in blocks/millisecond (should be less than 1/4 to respect block
// size in adjacent embeddings)
export const MAX_VEOCITY = 120 / 1000;

// Velocity threshold below which we just stop
export const STOP_VELOCITY = 0.001 / 1000;

// Number of steps to try when a collision is detected
export const COLLISION_INTERP_STEPS = 6;

export function overlap(s1, e1, s2, e2) {
  // Returns the amount of overlap between two line segments, given as start1,
  // end1, start2, end2.
  if (s1 >= s2) {
    return Math.max(0, Math.min(e1 - s1, e2 - s1));
  } else {
    return Math.max(0, Math.min(e1 - s2, e2 - s2));
  }
}

export function bb_overlap(bb1, bb2) {
  // Returns the area of overlap between the given bounding boxes, or 0 if they
  // don't overlap.
  // Bounding box format is an array of four numbers specifying (left, top),
  // (right, bottom) coordinates in that order. Top and left coordinates are
  // smaller than bottom and right coordinates.
  return overlap(
    bb1[0],
    bb1[2],
    bb2[0],
    bb2[2]
  ) * overlap(
    bb1[1],
    bb1[3],
    bb2[1],
    bb2[3]
  );
}

export function in_bb(pos, bb) {
  // Returns true if the given position is in the given bounding box.
  return (
    pos[0] >= bb[0]
 && pos[0] <= bb[2]
 && pos[1] >= bb[1]
 && pos[1] <= bb[3]
  );
}

var LAST_TICK_TIME = undefined;

export function tick_world(wld, trace) {
  // First figure out which panes are in-scope to be ticked, and then advance
  // the positions/states of all entities & blocks on those panes.
  let now = window.performance.now();
  let elapsed = 0;
  if (LAST_TICK_TIME == undefined) {
    LAST_TICK_TIME = now;
    return; // skip initial tick where elapsed is unknown
  } else {
    elapsed = now - LAST_TICK_TIME;
  }

  elapsed *= TIME_DILATION;

  let tick_blocks = false;
  if (
    Math.floor(now / BLOCK_TICK_DURATION)
  > Math.floor(LAST_TICK_TIME / BLOCK_TICK_DURATION)
  ) {
    tick_blocks = true;
  }

  let tcx = world.find_context(
    wld,
    [0, 0, 0, 0],
    trace,
    world.DEFAULT_CONTEXT_DEPTH
  );

  tick_panes(wld, elapsed, tcx[0], tick_blocks, -tcx[3]);

  LAST_TICK_TIME = now;
}

export function tick_panes(
  wld,
  elapsed,
  target_pid,
  tick_blocks,
  depth,
  memo
) {
  // Recursively ticks all entities and blocks in the given pane and panes
  // below it up to TICK_DEPTH.
  if (memo == undefined) {
    memo = {};
  }
  if (memo.hasOwnProperty(target_pid)) {
    return; // don't double-tick multi-visible frames
  }
  let pane = wld.panes[target_pid];
  if (depth > TICK_DEPTH || pane == undefined) {
    return; // depth cap and unloaded panes
  }
  // Remember that we've processed this pane
  memo[target_pid] = true;

  // Tick blocks:
  if (tick_blocks) {
    for (let x = 0; x < world.PANE_SIZE; ++x) {
      for (let y = 0; y < world.PANE_SIZE; ++y) {
        let bl = world.block_at(pane, [x, y]);
        if (BLOCK_PROGRESSIONS.hasOwnProperty(bl)) {
          world.set_block(pane, [x, y], BLOCK_PROGRESSIONS[bl]);
        }
      }
    }
  }

  // Tick entities:
  for (let eid of Object.keys(pane.entities)) {
    let entity = wld.entities[eid];
    tick_entity(wld, entity, elapsed);
  }

  // Recursively tick inlays:
  for (let inl of pane.inlays) {
    tick_panes(wld, elapsed, inl.id, tick_blocks, depth + 1, memo);
  }
}

export function tick_entity(wld, entity, elapsed) {
  let pane = wld.panes[entity.trace[entity.trace.length - 1][1]];
  let ex = entity.pos[0];
  let ey = entity.pos[1];
  let radius = entity.size/2 * entity.scale;

  let ebox = [
    ex - radius,
    ey - radius,
    ex + radius,
    ey + radius
  ];
  let tcx = world.find_context(
    wld,
    ebox,
    entity.trace,
    world.DEFAULT_CONTEXT_DEPTH
  );
  let surroundings = detect_surroundings(wld, tcx);
  let state = movement_state(entity, surroundings);

  // update cooldowns:
  for (let c of Object.keys(entity.cooldowns)) {
    entity.cooldowns[c] -= elapsed;
    if (entity.cooldowns[c] <= 0) {
      entity.cooldowns[c] = 0;
    }
  }

  // control multipliers:
  let horiz_control = 1;
  let vert_control = 1;
  let jump_control = 1;
  let h_traction = false;
  let v_traction = false;

  // environmental forces
  if (surroundings.in_wall) {
    // reset velocity
    entity.vel = wall_push(surroundings);
    horiz_control = 0;
    vert_control = 0;
    jump_control = 0;
  } else if (state == "falling") {
    entity.vel[1] += elapsed * GRAVITY;
    horiz_control = 1.0;
    vert_control = 0.0;
    jump_control = 0;
  } else if (state == "sliding") {
    entity.vel[1] += elapsed * GRAVITY/2;
    jump_control = 0.6;
    v_traction = true;
  } else if (state == "swimming") {
    if (!entity.capabilities.neutral_buoyancy) {
      entity.vel[1] -= elapsed * SWIMMER_BUOYANCY;
    }
    horiz_control = 0.8
    vert_control = 0.8
    jump_control = 0.1;
    h_traction = true;
    v_traction = true;
  } else if (state == "floating") {
    let submerged = submerged_portion(pane, entity);
    if (submerged < 0.5) {
      entity.vel[1] += elapsed * GRAVITY * (1 - 2*submerged);
      horiz_control = 0.6;
    } else {
      entity.vel[1] -= elapsed * BUOYANCY * (submerged - 0.5);
      horiz_control = 0.4;
    }
    vert_control = 0.2;
    jump_control = 0.1;
    h_traction = true;
  } else if (state == "climbing") {
    horiz_control = 0.8;
    vert_control = 0.8;
    jump_control = 0.8;
    h_traction = true;
    v_traction = true;
  } else if (state == "slipping") {
    horiz_control = 0.8;
    if (surroundings.on_platform) {
      vert_control = 1;
    } else {
      vert_control = 0.1;
    }
  } else if (state == "standing") {
    if (surroundings.on_platform) {
      vert_control = 1;
    } else {
      vert_control = 0.1;
    }
    h_traction = true;
  }

  // control forces:
  let cx = entity.ctl.x;
  let cy = entity.ctl.y;
  let cm = Math.sqrt(cx*cx + cy*cy);

  let cv = [0, 0]
  if (cm > 0) {
    cv = [
      (cx / cm) * entity.accel * horiz_control * elapsed,
      (cy / cm) * entity.accel * vert_control * elapsed
    ];
  }

  // if traction is available and controls are neutral or retrograde, damp
  // velocity
  if (h_traction && diff_sign(entity.vel[0], cv[0])) {
    entity.vel[0] /= 2;
  }
  if (v_traction && diff_sign(entity.vel[1], cv[1])) {
    entity.vel[1] /= 2;
  }

  // Add controls into velocity, respecting h/v caps:
  if (Math.abs(entity.vel[0] + cv[0]) > entity.hspeed) {
    if (entity.vel[0] + cv[0] < -entity.hspeed) {
      entity.vel[0] = -entity.hspeed;
    } else {
      entity.vel[0] = entity.hspeed;
    }
    cv[0] = 0;
  } else {
    entity.vel[0] += cv[0];
  }
  if (Math.abs(entity.vel[1] + cv[1]) > entity.vspeed) {
    if (entity.vel[1] + cv[1] < -entity.vspeed) {
      entity.vel[1] = -entity.vspeed;
    } else {
      entity.vel[1] = entity.vspeed;
    }
    cv[1] = 0;
  } else {
    entity.vel[1] += cv[1];
  }

  // Check for a jump
  if (jump_control > 0 && entity.ctl.jump && world.is_ready(entity, "jump")) {
    let jv = jump_vector(surroundings, entity.ctl);
    entity.cooldowns.jump = JUMP_COOLDOWN;
    entity.boosts.jump = {
      "vector": jv,
      "duration": entity.jump_duration,
      "max_duration": entity.max_jump_duration,
      "magnitude": entity.jump * jump_control,
      "elapsed": 0
    };
  }

  // Apply & update any boosts
  let expired = [];
  for (let k of Object.keys(entity.boosts)) {
    let bst = entity.boosts[k];
    console.log("Boost", bst, elapsed);
    let boost_time = elapsed;
    if (bst.duration - bst.elapsed > elapsed) { // boost isn't expiring
      bst.elapsed += elapsed;
    } else { // boost is expiring this tick
      boost_time = bst.duration - bst.elapsed;
      bst.elapsed = bst.duration;
      expired.push(k);
    }
    entity.vel[0] += bst.magnitude * bst.vector[0] * boost_time;
    entity.vel[1] += bst.magnitude * bst.vector[1] * boost_time;
    if (k == "jump" && entity.ctl.jump && bst.duration < bst.max_duration) {
      bst.duration += elapsed;
    }
  }
  for (let k of expired) {
    delete entity.boosts[k];
  }

  // cap velocity
  entity.vel = crop_velocity(entity.vel, MAX_VEOCITY);

  // stop when too slow:
  if (Math.abs(entity.vel[0]) < STOP_VELOCITY) {
    entity.vel[0] = 0;
  }
  if (Math.abs(entity.vel[1]) < STOP_VELOCITY) {
    entity.vel[1] = 0;
  }

  // respect terminal falling speed
  if (entity.vel[1] > entity.tvel) {
    entity.vel[1] = entity.tvel;
  }

  // respect blocked directions
  if (surroundings.blocked.up && entity.vel[1] < 0) {
    entity.vel[1] = 0;
  }
  if (surroundings.blocked.down && entity.vel[1] > 0) {
    entity.vel[1] = 0;
  }
  if (surroundings.blocked.left && entity.vel[0] < 0) {
    entity.vel[0] = 0;
  }
  if (surroundings.blocked.right && entity.vel[0] > 0) {
    entity.vel[0] = 0;
  }

  // apply velocity
  let vx = entity.vel[0] * elapsed;
  let vy = entity.vel[1] * elapsed;

  let newpos = [
    entity.pos[0] + vx,
    entity.pos[1] + vy
  ];

  // now zero velocity if we're being pushed out of a wall so we don't launch
  if (surroundings.in_wall) {
    entity.vel[0] = 0;
    entity.vel[1] = 0;
  }

  if (!surroundings.in_wall) { // if we're already in a wall don't get fancy
    let best_valid = entity.pos.slice();

    if (on_nearby_wall(surroundings, ebox, entity, newpos)) {
      let guess = 0.5;
      let adj = 0.25;
      for (let i = 0; i < COLLISION_INTERP_STEPS; ++i) {
        newpos = [
          entity.pos[0] + vx * guess,
          entity.pos[1] + vy * guess
        ];
        if (!on_nearby_wall(surroundings, ebox, entity, newpos)) {
          best_valid = newpos;
          guess += adj;
        } else {
          guess -= adj;
        }
        adj /= 2;
      }
      entity.pos = best_valid;
    } else {
      entity.pos = newpos;
    }
  } else {
    entity.pos = newpos;
  }

  // scaling and pane transitions
  ex = entity.pos[0];
  ey = entity.pos[1];

  ebox = [
    ex - radius,
    ey - radius,
    ex + radius,
    ey + radius
  ];
  // TODO: Is this really necessary?
  let new_tcx = world.find_context(
    wld,
    ebox,
    entity.trace,
    world.DEFAULT_CONTEXT_DEPTH
  );
  let nxpane = wld.panes[new_tcx[0]];
  let nxbox = new_tcx[1];
  let nxpos = [ (nxbox[0] + nxbox[2])/2, (nxbox[1] + nxbox[3])/2 ];
  let nxscale = new_tcx[2];
  let nxdepth = new_tcx[3];
  let tp = trace_pos(wld, nxpane, nxpos, -nxdepth);
  let retrace = tp[0];
  let new_pos = tp[1];
  let scale_diff = tp[2];
  let new_scale = (scale_diff / nxscale);
  let rel = trace_relationship(entity.trace, retrace);
  // Update position:
  entity.pos = new_pos;
  if (rel == undefined) { // non clear relationship
    console.warn("Retrace", entity.trace, retrace);
    world.set_entity_trace(entity, retrace);
  } else if (rel < 0) { // a retraction
    world.set_entity_trace(
      entity,
      entity.trace.slice(0, entity.trace.length + rel)
    );
  } else if (rel > 0) {
    world.set_entity_trace(
      entity,
      Array.concat(
        entity.trace,
        retrace.slice(retrace.length - rel, retrace.length)
      )
    );
  } else if (rel != 0) { // 0 = same trace -> no change
    console.error("Unexpected trace relationship: " + rel + "!");
    entity.trace = retrace;
  }
  // TODO: rescaling lag?
  // TODO: Fix partial scaling at borders?
}

export function wall_push(surroundings) {
  // Returns a velocity vector to push an entity out of a wall given the
  // entity's surroundings object.
  let result = [0, 0];
  if (surroundings.unblocked == 1) { // only one dir available
    if (!surroundings.blocked.down) {
      result[1] = 100; // will be capped
    } else if (!surroundings.blocked.up) {
      result[1] = -100; // will be capped
    } else if (!surroundings.blocked.left) {
      result[0] = -100; // will be capped
    } else { // down must be unblocked
      result[0] = 100; // will be capped
    }
  } else if (surroundings.unblocked == 2) {
    if (surroundings.blocked.down && surroundings.blocked.up) {
      // Push left
      console.warn("Stuck on opposite sides!");
      result[0] = -100; // will be capped
    } else if (surroundings.blocked.left && surroundings.blocked.right) {
      // Push up
      console.warn("Stuck on opposite sides!");
      result[1] = -100; // will be capped
    } else {
      if (!surroundings.blocked.down) {
        result[1] = 100; // will be capped
      } else if (!surroundings.blocked.up) {
        result[1] = -100; // will be capped
      } else if (!surroundings.blocked.left) {
        result[0] = -100; // will be capped
      } else { // down must be unblocked
        result[0] = 100; // will be capped
      }
    }
  } else if (surroundings.unblocked == 3) {
    // Push away from the blocked direction
    if (surroundings.blocked.down) {
      result[1] = -100; // will be capped
    } else if (surroundings.blocked.up) {
      result[1] = 100; // will be capped
    } else if (surroundings.blocked.left) {
      result[0] = 100; // will be capped
    } else { // right must be blocked
      result[0] = -100; // will be capped
    }
  } else { // either 4 or 0 unblocked, so we've got nowhere to go!
    console.warn("Stuck in wall (" + surroundings.unblocked + ")!");
    // TODO: Randomize position
  }
  return result;
}

export function crop_velocity(vel, cap) {
  let x = vel[0];
  let y = vel[1];
  let vlen = Math.sqrt(x*x + y*y);
  if (vlen >= cap) {
    vel[0] = (x / vlen) * cap;
    vel[1] = (y / vlen) * cap;
  }
  return vel;
}

export function unit_vector(pis) {
  return [ Math.cos(Math.PI * pis), -Math.sin(Math.PI * pis) ];
}

export function jump_vector(surroundings, ctl) {
  if (surroundings.blocked.up) {
    if (ctl.x > 0) {
      return [1, 0];
    } else if (ctl.x < 0) {
      return [-1, 0];
    } else {
      return [0, 1];
    }
  } else if (surroundings.blocked.down || surroundings.on_platform) {
    return [0, -1];
  } else {
    if (surroundings.blocked.left && !surroundings.blocked.right) {
      return unit_vector(0.42);
    } else if (surroundings.blocked.right && !surroundings.blocked.left) {
      return unit_vector(0.58);
    }
  }
  console.warn("Unknown jump situation:");
  console.warn(surroundings);
  return [0, 1];
}

export function on_nearby_wall(surroundings, inner_bbox, entity, pos) {
  // Uses the given surroundings object to check whether the given entity would
  // be on a wall at the given position. It needs to be given the original bbox
  // used to create the context for the surroundings so that it can do the
  // necessary transformations.
  let radius = entity.size/2 * entity.scale;
  let ebox = [
    pos[0] - radius,
    pos[1] - radius,
    pos[0] + radius,
    pos[1] + radius
  ];

  // bounding box of the entity at this position in the outer pane
  let obox = world.rebox_box(inner_bbox, surroundings.context[1], ebox);

  let hit = blocks_in_surroundings(surroundings, obox);
  for (let b of Object.keys(hit)) {
    if (blocks.is_solid(b)) {
      return true;
    }
  }
  return false;
}

export function overlaps_wall(wld, entity, pane, pos, depth_adj) {
  // Returns true if the given entity would overlap a wall in the given pane or
  // one of its inclusions if it were at the given position. depth_adj can be
  // used to indicate the depth of the pane relative to the entity (e.g., -1
  // for the parent pane of the entity).
  let ex = pos[0];
  let ey = pos[1];
  let radius = entity.size/2;

  let overlaps = blocks_in_bb(
    wld,
    pane, 
    [
      ex - radius,
      ey - radius,
      ex + radius,
      ey + radius
    ],
    depth_adj
  );

  for (let b of Object.keys(overlaps)) {
    if (blocks.is_solid(b)) {
      return true;
    }
  }
  return false;
}

export function movement_state(entity, surroundings) {
  // Given an entity's surroundings, checks its capabilities to come up with
  // its current movement state. Returns one of:
  //
  //   swimming - the entity is swimming in liquid.
  //   floating - the entity is floating in liquid (can't swim).
  //   sliding - the entity is sliding down a nearby wall.
  //   standing - the entity is standing on solid ground.
  //   slipping - the entity is sliding along slippery ground.
  //   climbing - the entity is climbing on a nearby wall.
  //   falling - the entity is free-falling in open air, or at least doesn't
  //             have the capability to climb anything nearby.
  //

  let result = "falling";

  if (surroundings.in_liquid) {
    // ignore further checks in this case
    if (entity.capabilities.swim) {
      return "swimming";
    } else {
      return "floating";
    }
  }

  if (surroundings.on_floor || surroundings.on_platform) {
    result = "standing";
  }
  if (
    result == "standing"
 && surroundings.slippery_floor && !entity.capabilities.skate
  ) {
    result = "slipping";
  }

  if (result != "standing") {
    if (
      (
        entity.capabilities.climb
     && (surroundings.climable_adjacent || surroundings.in_climable)
      )
   || (entity.capabilities.climb_smooth && surroundings.smooth_adjacent)
   || (
        entity.capabilities.hang
     && (surroundings.climable_above || surroundings.in_climable)
      )
   || (entity.capabilities.hang_smooth && surroundings.smooth_above)
    ) {
      result = "climbing";
    }
  }

  if (result == "falling") {
    if (
      (
        entity.capabilities.wall_slide
     && (surroundings.climable_adjacent || surroundings.in_climable)
      )
   || (entity.capabilities.slide_smooth && surroundings.smooth_adjacent)
    ) {
      result = "sliding";
    }
  }
  
  return result;
}

export function entity_surroundings(entity) {
  // Gets the canonical surroundings object for an entity. Uses
  // world.find_context on the entity's bounding box and then detects the
  // surroundings for that context.
  let wld = world.by_name(entity.world);

  let ex = entity.pos[0];
  let ey = entity.pos[1];
  let radius = entity.size/2 * entity.scale;

  let ebox = [
    ex - radius,
    ey - radius,
    ex + radius,
    ey + radius
  ];
  let tcx = world.find_context(
    wld,
    ebox,
    entity.trace,
    world.DEFAULT_CONTEXT_DEPTH
  );
  return detect_surroundings(wld, tcx);
}

export function detect_surroundings(wld, context) {
  // Detects the surroundings of a bounding box, including nearby objects on
  // all sides and any current overlaps. The context must be an object
  // returned by world.find_context. The core data structure produced is a
  // 'tiles' array that contains tile type data at 1/4 unit resolution (taking
  // into account the given scale factor), large enough to contain the given
  // bounding box plus at least a 1/4 unit border around it.
  //
  // The resulting object uses the following flags:
  //
  //   context - the provided context object in full
  //
  //   tiles - the aforementioned array
  //   tile_origin - the origin position of the tile grid, relative to the
  //     given pane
  //   tile_size - the size of each tile of the tile grid in the given pane
  //
  //   in_wall - overlaps a solid block
  //   in_liquid - overlaps a liquid block
  //   in_climable - overlaps a climable block
  //
  //   on_floor - there's a floor directly below
  //   slippery_floor - the floor below is slippery (only when on_floor)
  //
  //   on_liquid - there's liquid below
  //
  //   smooth_adjacent - there's an adjacent wall, but it's smooth
  //   climable_adjacent - there's a non-smooth adjacent wall
  //
  //   smooth_above - there's a wall above, but it's smooth
  //   climable_above - there's a non-smooth wall above
  //
  //   blocked - map showing which directions are blocked ("up," "left,"
  //     "right," and/or "down"
  //   unblocked - integer number of unblocked directions
  //
  //   scale - the average scale of inlays that the given bounding box overlaps
  //     among those on the given pane. This value is relative to the given
  //     base pane.

  let pane = wld.panes[context[0]];
  let bbox = context[1];
  let scale = context[2];
  let depth_adj = -context[3];

  let result = {
    "context": context,
    "tiles": [],
    "blocked": {},
    "unblocked": 4,
    "scale": avg_scale(wld, pane, bbox, depth_adj)
  };

  let bxleft = bbox[0];
  let bxtop = bbox[1];
  let bxright = bbox[2];
  let bxbot = bbox[3];

  // multiply by scale factor to convert bbox outer units to inner units
  //let tile_size = (1/4) * scale;
  // TODO: DEBUG
  let tile_size = (1/4) * scale;
  result.tile_size = tile_size;
  let rres = 1 / tile_size;

  let rleft = Math.floor(bxleft*rres) - 1;
  let rtop = Math.floor(bxtop*rres) - 1;
  let rright = Math.ceil(bxright*rres); // the <= below means +1 not needed
  let rbot = Math.ceil(bxbot*rres);
  result.tile_origin = [rleft/rres, rtop/rres];

  for (let x = rleft; x <= rright; ++x) {
    let col = [];
    result.tiles.push(col);
    for (let y = rtop; y <= rbot; ++y) {
      let block = block_in_pane(
        wld,
        pane,
        [(x+0.5)/rres, (y+0.5)/rres],
        depth_adj
      );
      col.push(block);
    }
  }

  // Compute adjacency zone size (symmetric; smaller of % or absolute)
  let azwidth = ADJACENCY_ZONE_SIZE * (bxright - bxleft);
  let azheight = ADJACENCY_ZONE_SIZE * (bxbot - bxtop);
  let azsize = Math.min(azwidth, azheight, ADJACENCY_ZONE_MAX_SIZE * tile_size);

  // blocks_in_surroundings can already work using the partial result, so we
  // use it to define our on/above/below/left/right block sets.
  let on = blocks_in_surroundings(result, bbox);
  let above = blocks_in_surroundings(
    result,
    [
      bxleft, 
      bxtop - azsize,
      bxright,
      bxtop
    ]
  );
  let below = blocks_in_surroundings(
    result,
    [
      bxleft,
      bxbot,
      bxright,
      bxbot + azsize
    ]
  );
  let left = blocks_in_surroundings(
    result,
    [
      bxleft - azsize,
      bxtop,
      bxleft,
      bxbot
    ]
  );
  let right = blocks_in_surroundings(
    result,
    [
      bxright,
      bxtop,
      bxright + azsize,
      bxbot
    ]
  );

  for (let b of Object.keys(on)) {
    if (blocks.is_solid(b)) {
      result["in_wall"] = true;
    }
    if (blocks.is_liquid(b)) {
      result["in_liquid"] = true;
    }
    if (blocks.is_climable(b)) {
      result["in_climable"] = true;
    }
  }

  let only_slippery = true;
  for (let b of Object.keys(below)) {
    if (blocks.is_platform(b)) {
      result["on_platform"] = true;
    }
    if (blocks.is_solid(b)) {
      result["on_floor"] = true;
      result.blocked["down"] = true;
      result.unblocked -= 1;
    }
    if (!blocks.is_slippery(b)) {
      only_slippery = false;
    }
  }
  if ((result.on_floor || result.on_platform) && only_slippery) {
    result["slippery_floor"] = true;
  }

  let any_climable = false;
  let smooth_only = true;
  for (let b of Object.keys(left)) {
    if (blocks.is_solid(b) || blocks.is_climable(b)) {
      any_climable = true;
      if (!blocks.is_smooth(b)) {
        smooth_only = false;
      }
    }
    if (blocks.is_solid(b)) {
      result.blocked["left"] = true;
      result.unblocked -= 1;
    }
  }
  for (let b of Object.keys(right)) {
    if (blocks.is_solid(b) || blocks.is_climable(b)) {
      any_climable = true;
      if (!blocks.is_smooth(b)) {
        smooth_only = false;
      }
    }
    if (blocks.is_solid(b)) {
      result.blocked["right"] = true;
      result.unblocked -= 1;
    }
  }
  if (any_climable) {
    if (smooth_only) {
      result["smooth_adjacent"] = true;
    } else {
      result["climable_adjacent"] = true;
    }
  }

  any_climable = false;
  smooth_only = true;
  for (let b of Object.keys(above)) {
    if (blocks.is_solid(b) || blocks.is_climable(b)) {
      any_climable = true;
      if (!blocks.is_smooth(b)) {
        smooth_only = false;
      }
    }
    if (blocks.is_solid(b)) {
      result.blocked["up"] = true;
      result.unblocked -= 1;
    }
  }
  if (any_climable) {
    if (smooth_only) {
      result["smooth_above"] = true;
    } else {
      result["climable_above"] = true;
    }
  }

  return result;
}

function blocks_in_surroundings(surroundings, bbox) {
  // Returns a map of block IDs that are within the given bbox in the given
  // surroundings object. The bbox should be given relative to the coordinate
  // system of the pane used to construct the surroundings.
  let sbox = [
    (bbox[0] - surroundings.tile_origin[0]) / surroundings.tile_size,
    (bbox[1] - surroundings.tile_origin[1]) / surroundings.tile_size,
    (bbox[2] - surroundings.tile_origin[0]) / surroundings.tile_size,
    (bbox[3] - surroundings.tile_origin[1]) / surroundings.tile_size
  ];
  result = {};
  for (let x = Math.floor(sbox[0]); x<= Math.floor(sbox[2]); ++x) {
    if (x < 0 || x >= surroundings.tiles.length) {
      continue;
    }
    let col = surroundings.tiles[x];
    for (let y = Math.floor(sbox[1]); y<= Math.floor(sbox[3]); ++y) {
      if (y < 0 || y >= col.length) {
        continue;
      }
      let b = col[y];
      if (b != undefined) {
        result[b] = true;
      }
    }
  }
  return result;
}

export function block_in_pane(wld, pane, pos, depth) {
  // Returns the block ID for the block in the given pane at the given
  // position, including inlays down to a depth of TICK_DEPTH. Returns CHAOS
  // when on an inlay that's too deep, or when outside the bounds of the given
  // pane.
  if (depth == undefined) {
    depth = 0;
  } else if (depth > TICK_DEPTH || pane == undefined) {
    return blocks.CHAOS;
  }
  for (let inl of pane.inlays) {
    if (in_bb(pos, world.inlay_bounds(inl))) {
      let sf = world.inlay_scale_factor(inl);
      return block_in_pane(
        wld,
        wld.panes[inl.id],
        [
          world.inner_coord(pos[0], inl.at[0], sf),
          world.inner_coord(pos[1], inl.at[1], sf)
        ],
        depth + 1
      )
    }
  }
  // Not in an inlay, so look up within the pane:
  let inpane = world.block_at(pane, pos);
  if (inpane == undefined) {
    return blocks.CHAOS;
  } else {
    return inpane;
  }
}

export function blocks_in_bb(wld, pane, bb, depth) {
  // Returns a list of block IDs that overlap with the given bounding box
  // (which should be a left, top, right, bottom coordinate array). Includes
  // blocks from inlays, and even CHAOS if a deep enough inlay is hit (deeper
  // than TICK_DEPTH), but does not include blocks from parent panes.
  if (depth == undefined) {
    depth = 0;
  } else if (depth > TICK_DEPTH || pane == undefined) {
    let result = {};
    result[blocks.CHAOS] = true;
    return result;
  }
  let result = [];
  for (let x = Math.floor(bb[0]); x<= Math.floor(bb[2]); ++x) {
    for (let y = Math.floor(bb[1]); y<= Math.floor(bb[3]); ++y) {
      let b = world.block_at(pane, [x, y]);
      if (b != undefined) {
        result[b] = true;
      }
    }
  }
  for (let inl of pane.inlays) {
    if (bb_overlap(bb, world.inlay_bounds(inl)) > 0) {
      let sf = world.inlay_scale_factor(inl);
      for (
        b
      of
        Object.keys(
          blocks_in_bb(
            wld,
            wld.panes[inl.id],
            [
              world.inner_coord(bb[0], inl.at[0], sf),
              world.inner_coord(bb[1], inl.at[1], sf),
              world.inner_coord(bb[2], inl.at[0], sf),
              world.inner_coord(bb[3], inl.at[1], sf),
            ],
            depth + 1
          )
        )
      ) {
        result[b] = true;
      }
    }
  }
  return result;
}

export function submerged_portion(pane, entity) {
  // TODO:
  return 1;
}

export function diff_sign(x, y) {
  return (
    x < 0 && y > 0
 || x > 0 && y < 0
 || x == 0 && y != 0
 || x != 0 && y == 0
  );
}

export function avg_scale(wld, pane, bb, depth) {
  // Returns the average scale of the given bounding box, according to which
  // inlays it overlaps. For bounding boxes that don't overlap any inlays,
  // returns 1.0.
  if (depth == undefined) {
    depth = 0;
  }
  if (depth > 2 || pane == undefined) {
    return 1.0;
  }
  let bba = (bb[2] - bb[0]) * (bb[3] - bb[1]);
  let weights = [];
  let leftovers = 1;
  let values = [];
  for (let inl of pane.inlays) {
    let ov = bb_overlap(bb, world.inlay_bounds(inl));
    if (ov > 0) {
      let sf = world.inlay_scale_factor(inl);
      let sub_scale = avg_scale(
        wld,
        wld.panes[inl.id], 
        [
            world.inner_coord(bb[0], inl.at[0], sf),
            world.inner_coord(bb[1], inl.at[1], sf),
            world.inner_coord(bb[2], inl.at[0], sf),
            world.inner_coord(bb[3], inl.at[1], sf),
        ],
        depth + 1
      );
      let w = ov / bba;
      weights.push(w);
      leftovers -= w;
      values.push(sf * sub_scale);
    }
  }
  let result = leftovers;
  for (let i = 0; i < weights.length; ++i) {
    result += weights[i] * values[i];
  }
  return result;
}

export function trace_same(tr1, tr2) {
  // Returns true if the two trace objects are the same, and false otherwise.
  if (tr1.length != tr2.length) {
    return false;
  }
  for (let i = 0; i < tr1.length; ++i) {
    let t1 = tr1[i];
    let t2 = tr2[i];
    if (
      (t1[0] == undefined && t2[0] != undefined)
   || (t2[0] == undefined && t1[0] != undefined)
   || (t1[0][0] != t2[0][0] || t1[0][1] != t2[0][1])
   || (t1[1] != t2[1])
    ) {
      return false;
    }
  }
  return true;
}

export function trace_is_suffix(orig, suf) {
  // Returns true if the second trace is a suffix of (or equal to) the first.
  if (suf.length > orig.length) {
    return false;
  }
  j = orig.length - 1;
  for (let i = suf.length - 1; i >= 0; --i) { // iterate backwards in suffix
    let st = suf[i];
    let ot = orig[j];
    if (
      (ot[0] == undefined && st[0] != undefined)
   || (st[0] != undefined && (st[0][0] != ot[0][0] || st[0][1] != ot[0][1]))
   // st[0] undefined can match any ot[0]
   || (st[1] != ot[1])
    ) {
      return false;
    }
    --j; // walk backward in original list
  }
  return true;
}

export function trace_relationship(orig, novel) {
  // Returns an integer indicating the relationship between the two traces:
  //  -2 -> novel is a depth-2 retraction of the original
  //  -1 -> novel is a depth-1 retraction of the original
  //   0 -> same trace, or novel is a suffix or original
  //   1 -> novel is a depth-1 extension of the original
  //   2 -> novel is a depth-2 extension of the original
  //  undefined -> No identifiable relationship
  if (trace_is_suffix(orig, novel)) {
    return 0;
  } else if (
    novel.length > 1
 && trace_is_suffix(orig, novel.slice(0, novel.length-1))
  ) {
    return 1;
  } else if (
    novel.length > 2
 && trace_is_suffix(orig, novel.slice(0, novel.length-2))
  ) {
    return 2;
  } else if (
    orig.length > 1
 && trace_is_suffix(orig.slice(0, orig.length - 1), novel)
  ) {
    return -1;
  } else if (
    orig.length > 2
 && trace_is_suffix(orig.slice(0, orig.length - 2), novel)
  ) {
    return -2;
  } else {
    return undefined; // unknown
  }
}

export function trace_pos(wld, pane, pos, depth) {
  // Returns a trace to the given position, starting at the given base pane,
  // along with a relative position in the trace's innermost pane, and a scale
  // factor relative to the given pane.
  if (depth == undefined) {
    depth = 0;
  }
  if (depth > 2 || pane == undefined) {
    if (pane == undefined) {
      return [undefined, pos, 1.0];
    } else {
      return [[ [undefined, pane.id] ], pos, 1.0];
    }
  }
  let subtrace = undefined;
  let subpos = undefined;
  let subscale = undefined;
  let entrance = undefined;
  let sf = undefined;
  for (let inl of pane.inlays) {
    if (in_bb(pos, world.inlay_bounds(inl))) {
      sf = world.inlay_scale_factor(inl);
      entrance = inl.at.slice();
      let tp = trace_pos(
        wld,
        wld.panes[inl.id],
        [
          world.inner_coord(pos[0], inl.at[0], sf),
          world.inner_coord(pos[1], inl.at[1], sf)
        ],
        depth + 1
      );
      subtrace = tp[0];
      subpos = tp[1];
      subscale = tp[2];
      break;
    }
  }
  if (subtrace != undefined) {
    return [
      Array.concat(
        [ [undefined, pane.id], [entrance, subtrace[0][1]] ],
        subtrace.slice(1,subtrace.length)
      ),
      subpos,
      sf * subscale
    ];
  } else {
    return [[ [undefined, pane.id] ], pos, 1.0];
  }
}
