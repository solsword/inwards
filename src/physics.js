// physics.js
// Physics engine

import * as blocks from "./blocks";
import * as world from "./world";

export var BLOCK_TICK_DURATION = 1000;

export var JUMP_COOLDOWN = 150;

export var BLOCK_PROGRESSIONS = {};
BLOCK_PROGRESSIONS[blocks.by_id("点滅㈠")] = blocks.by_id("点滅㈡");
BLOCK_PROGRESSIONS[blocks.by_id("点滅㈡")] = blocks.by_id("点滅㈢");
BLOCK_PROGRESSIONS[blocks.by_id("点滅㈢")] = blocks.by_id("点滅㈠");

// Size of region around an entity that counts for detecting nearby terrain.
export var ENTITY_BORDER_SIZE = 0.1;

// Modifies elapsed time to slow down in-game time relative to real time.
export var TIME_DILATION = 0.1;

// Gravity in blocks/millisecond
export var GRAVITY = 0.5 / 1000.0;

// Buoyancy in blocks/millisecond (of course that's not how it works)
export var BUOYANCY = 0.08 / 1000.0;

// Buoyancy for swimming non-fish
export var SWIMMER_BUOYANCY = 0.01 / 1000.0;

// Velocity cap in blocks/millisecond
export var MAX_VEOCITY = 120 / 1000.0;

// Number of steps to try when a collision is detected
export var COLLISION_INTERP_STEPS = 6;

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
    return;
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

  let tcx = world.find_context(wld, [0, 0, 0, 0], trace);

  tick_panes(wld, elapsed, tcx[0], tick_blocks, -tcx[3]);

  LAST_TICK_TIME = now;
}

export function tick_panes(wld, elapsed, target_pid, tick_blocks, depth) {
  // Recursively ticks all entities and blocks in the given pane and panes
  // below it up to depth 2.
  if (depth > 2) {
    return;
  }

  let pane = wld.panes[target_pid];

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
    tick_entity(wld, pane, entity, elapsed);
  }

  // Recursively tick inlays:
  for (let inl of pane.inlays) {
    tick_panes(wld, elapsed, inl.id, tick_blocks, depth + 1);
  }
}

export function tick_entity(wld, pane, entity, elapsed) {
  let ex = entity.pos[0];
  let ey = entity.pos[1];
  let radius = entity.size/2 * entity.scale;

  let ebox = [
    ex - radius,
    ey - radius,
    ex + radius,
    ey + radius
  ];
  let tcx = world.find_context(wld, ebox, entity.trace);
  let cxpane = wld.panes[tcx[0]];
  let cxbox = tcx[1];
  let cxscale = tcx[2];
  let cxdepth = tcx[3];

  let surroundings = detect_surroundings(wld, cxpane, cxbox, -cxdepth);
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
    horiz_control = 0;
    vert_control = 0;
    jump_control = 0;
    // push out of the wall
    if (!surroundings.blocked.above) {
      entity.vel[1] -= 1 * elapsed;
    }
    if (!surroundings.blocked.below) {
      entity.vel[1] += 1 * elapsed;
    }
    if (!surroundings.blocked.left) {
      entity.vel[0] -= 1 * elapsed;
    }
    if (!surroundings.blocked.right) {
      entity.vel[0] += 1 * elapsed;
    }
  } else if (state == "falling") {
    entity.vel[1] += elapsed * GRAVITY;
    horiz_control = 1.0;
    vert_control = 0.0;
    jump_control = 0;
  } else if (state == "sliding") {
    entity.vel[1] += elapsed * GRAVITY/2;
    entity.vel[1] /= 2;
    jump_control = 0.6;
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
    vert_control = 0;
  } else if (state == "standing") {
    vert_control = 0;
    h_traction = true;
  }

  // control forces:
  let cx = entity.ctl.x;
  let cy = entity.ctl.y;
  let cm = Math.sqrt(cx*cx + cy*cy);

  let cv = [0, 0]
  if (cm > 0) {
    cv = [
      (cx / cm) * entity.accel * horiz_control,
      (cy / cm) * entity.accel * vert_control
    ];
  }

  // nix controls when speed has been achieved:
  if (Math.abs(entity.vel[0] + cv[0] * elapsed) > entity.hspeed) {
    cv[0] = 0;
  }
  if (Math.abs(entity.vel[1] + cv[1] * elapsed) > entity.vspeed) {
    cv[1] = 0;
  }

  // if traction is available, damp velocity
  if (h_traction && diff_sign(entity.vel[0], cv[0])) {
    entity.vel[0] /= 2;
  }
  if (v_traction && diff_sign(entity.vel[1], cv[1])) {
    entity.vel[1] /= 2;
  }

  entity.vel[0] += cv[0] * elapsed;
  entity.vel[1] += cv[1] * elapsed;

  if (jump_control > 0 && entity.ctl.jump && world.is_ready(entity, "jump")) {
    let jv = jump_vector(surroundings, entity.ctl);
    entity.cooldowns.jump = JUMP_COOLDOWN;
    entity.vel[0] += entity.jump * jv[0] * jump_control;
    entity.vel[1] += entity.jump * jv[1] * jump_control;
  }

  // cap velocity
  entity.vel = crop_velocity(entity.vel, MAX_VEOCITY);

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
  let vx = entity.vel[0] * elapsed * entity.scale;
  let vy = entity.vel[1] * elapsed * entity.scale;

  // zero velocity if we're being pushed out of a wall
  if (surroundings.in_wall) {
    entity.vel[0] = 0;
    entity.vel[1] = 0;
  }

  let newpos = [
    entity.pos[0] + vx,
    entity.pos[1] + vy
  ];

  let best_valid = entity.pos.slice();
  if (!surroundings.in_wall && overlaps_wall(wld, pane, entity, newpos)) {
    let guess = 0.5;
    let adj = 0.25;
    for (let i = 0; i < COLLISION_INTERP_STEPS; ++i) {
      let newpos = [
        entity.pos[0] + vx * guess,
        entity.pos[1] + vy * guess
      ];
      if (!overlaps_wall(wld, pane, entity, newpos)) {
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

  // scaling and pane transitions
  ex = entity.pos[0];
  ey = entity.pos[1];

  ebox = [
    ex - radius,
    ey - radius,
    ex + radius,
    ey + radius
  ];
  let new_tcx = world.find_context(wld, ebox, entity.trace);
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
  if (retrace.length > entity.trace.length) {
    entity.trace = retrace;
    entity.pos = new_pos;
    entity.scale = new_scale;
  } else {
    let above = entity.trace.slice(0, entity.trace - cxdepth);
    entity.trace = Array.concat(above, retrace);
    entity.pos = new_pos;
    entity.scale = new_scale;
  }
  // TODO: rescaling lag?
  // TODO: Fix partial scaling at borders?
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
  } else if (surroundings.blocked.down) {
    return [0, -1];
  } else {
    if (surroundings.blocked.left && !surroundings.blocked.right) {
      return unit_vector(0.35);
    } else if (surroundings.blocked.right && !surroundings.blocked.left) {
      return unit_vector(0.65);
    }
  }
}

export function overlaps_wall(wld, pane, entity, pos) {
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
    ]
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

  if (surroundings.on_floor) {
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

export function detect_surroundings(wld, pane, bbox, depth_adj) {
  // Detects the surroundings of a bounding box, including nearby objects on
  // all sides and any current overlaps. The resulting object uses the
  // following flags:
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
  // It also includes a "blocked" key that indicates whether the entity is
  // blocked from moving "up," "left," "right," and/or "down."
  //
  // Finally, it includes an "scale" value that indicates the average scale of
  // inlays that the given bounding box overlaps among those on the given pane.
  // This value is relative to the given base pane.

  let result = {
    "blocked": {},
    "scale": avg_scale(wld, pane, bbox, depth_adj)
  };

  let bxleft = bbox[0];
  let bxtop = bbox[1];
  let bxright = bbox[2];
  let bxbot = bbox[3];
  let hsz = bxright - bxleft;
  let vsz = bxbot - bxtop;
  let hpad = hsz * ENTITY_BORDER_SIZE;
  let vpad = vsz * ENTITY_BORDER_SIZE;

  let on = blocks_in_bb(
    wld,
    pane,
    bbox,
    depth_adj
  );
  let above = blocks_in_bb(
    wld,
    pane,
    [
      bxleft,
      bxtop - vpad,
      bxright, 
      bxtop
    ],
    depth_adj
  );
  let below = blocks_in_bb(
    wld,
    pane,
    [
      bxleft,
      bxbot,
      bxright, 
      bxbot + vpad
    ],
    depth_adj
  );
  let left = blocks_in_bb(
    wld,
    pane,
    [
      bxleft - hpad,
      bxtop,
      bxleft, 
      bxbot
    ],
    depth_adj
  );
  let right = blocks_in_bb(
    wld,
    pane,
    [
      bxright,
      bxtop,
      bxright + hpad, 
      bxbot
    ],
    depth_adj
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
    if (blocks.is_solid(b)) {
      result["on_floor"] = true;
      result.blocked["down"] = true;
    }
    if (!blocks.is_slippery(b)) {
      only_slippery = false;
    }
  }
  if (result.on_floor && only_slippery) {
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

export function blocks_in_bb(wld, pane, bb, depth) {
  // Returns a list of block IDs that overlap with the given bounding box
  // (which should be a left, top, right, bottom coordinate array). Includes
  // blocks from inlays, and even CHAOS if a deep enough inlay is hit.
  if (depth == undefined) {
    depth = 0;
  } else if (depth > 2) {
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
  if (depth > 2) {
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

export function trace_pos(wld, pane, pos, depth) {
  // Returns a trace to the given position, starting at the given base pane,
  // along with a relative position in the trace's innermost pane, and a scale
  // factor relative to the given pane.
  if (depth == undefined) {
    depth = 0;
  }
  if (depth > 2) {
    return [[ [undefined, pane.id] ], pos, 1.0];
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
