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

export function touches(bb1, bb2) {
  // Returns true if the given bounding boxes touch each other.
  // Bounding box format is an array of four numbers specifying (left, top),
  // (right, bottom) coordinates in that order. Top and left coordinates are
  // smaller than bottom and right coordinates.
  let l1 = bb1[0];
  let t1 = bb1[1];
  let r1 = bb1[2];
  let b1 = bb1[3];
  let l2 = bb2[0];
  let t2 = bb2[1];
  let r2 = bb2[2];
  let b2 = bb2[3];
  return !(
    r1 < l2
 || l1 > r2
 || t1 > b2
 || b1 < t2
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

  tick_panes(wld, elapsed, tcx[0], tick_blocks, -tcx[2]);

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
  let surroundings = detect_surroundings(wld, pane, entity);
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
  let newpos = [
    entity.pos[0] + entity.vel[0] * elapsed,
    entity.pos[1] + entity.vel[1] * elapsed
  ];

  let best_valid = entity.pos.slice();
  if (overlaps_wall(wld, pane, entity, newpos)) {
    let guess = 0.5;
    let adj = 0.25;
    for (let i = 0; i < COLLISION_INTERP_STEPS; ++i) {
      let newpos = [
        entity.pos[0] + entity.vel[0] * elapsed * guess,
        entity.pos[1] + entity.vel[1] * elapsed * guess
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
    // TODO: Just zero velocity in collision direction!
    entity.vel = [0, 0];
  } else {
    entity.pos = newpos;
  }

  // TODO: Transitions into inlays & out into parent panes
  // TODO: Do walls in parent panes work properly?
  // TODO: Jumping!
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
    if (ctl.x > 0) {
      return unit_vector(0.45);
    } else if (ctl.x < 0) {
      return unit_vector(0.55);
    } else {
      return [0, -1];
    }
  } else {
    if (surroundings.blocked.left && !surroundings.blocked.right) {
      if (ctl.x < 0) {
        return unit_vector(0.35);
      } else {
        return unit_vector(0.3);
      }
    } else if (surroundings.blocked.right && !surroundings.blocked.left) {
      if (ctl.x > 0) {
        return unit_vector(0.65);
      } else {
        return unit_vector(0.7);
      }
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

  for (let b of overlaps) {
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

export function detect_surroundings(wld, pane, entity) {
  // Detects an entity's surroundings, including nearby objects on all sides
  // and any current overlaps. The resulting object uses the following flags:
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

  let result = {
    "blocked": {}
  };

  let ex = entity.pos[0];
  let ey = entity.pos[1];
  let sz = entity.size;

  let pad = sz * ENTITY_BORDER_SIZE;
  let radius = sz/2;

  let above = blocks_in_bb(
    wld,
    pane,
    [
      ex - radius,
      ey - radius - pad,
      ex + radius, 
      ey - radius
    ]
  );
  let below = blocks_in_bb(
    wld,
    pane,
    [
      ex - radius,
      ey + radius,
      ex + radius, 
      ey + radius + pad
    ]
  );
  let left = blocks_in_bb(
    wld,
    pane,
    [
      ex - radius - pad,
      ey - radius,
      ex - radius, 
      ey + radius
    ]
  );
  let right = blocks_in_bb(
    wld,
    pane,
    [
      ex + radius,
      ey - radius,
      ex + radius + pad, 
      ey + radius
    ]
  );
  let on = blocks_in_bb(
    wld,
    pane,
    [
      ex - radius,
      ey - radius,
      ex + radius,
      ey + radius
    ]
  );

  for (let b of on) {
    if (blocks.is_solid(b)) {
      result["in_wall"] = true;
      result.blocked["up"] = true;
      result.blocked["down"] = true;
      result.blocked["left"] = true;
      result.blocked["right"] = true;
    }
    if (blocks.is_liquid(b)) {
      result["in_liquid"] = true;
    }
    if (blocks.is_climable(b)) {
      result["in_climable"] = true;
    }
  }

  let only_slippery = true;
  for (let b of below) {
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
  for (let b of left) {
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
  for (let b of right) {
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

  any_climable = true;
  smooth_only = true;
  for (let b of above) {
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
    return [ blocks.CHAOS ];
  }
  let result = [];
  // TODO: Outside/inside blocks!
  for (let x = Math.floor(bb[0]); x<= Math.floor(bb[2]); ++x) {
    for (let y = Math.floor(bb[1]); y<= Math.floor(bb[3]); ++y) {
      let b = world.block_at(pane, [x, y]);
      if (b != undefined) {
        result.push(b);
      }
    }
  }
  for (let inl of pane.inlays) {
    if (touches(bb, world.inlay_bounds(inl))) {
      let sf = world.inlay_scale_factor(inl);
      result = Array.concat(
        result,
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
      );
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
