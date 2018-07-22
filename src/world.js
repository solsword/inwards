// world.js
// World generation & representation code

import * as blocks from "./blocks";

// Constants
export var PANE_SIZE = 24;

// Globals
export var WORLDS = {};

export function get_scale_factor(wld, outer_id, pos) {
  // Figures out the scale factor between the inner pane at the given position
  // in the given pane and that outer pane. Returns NaN if there isn't an inlay
  // at that location.
  //
  // The scale factor is defined by the ratio of inner to outer units. So if an
  // inlay takes up 8×8 blocks of a 24×24 block pane, the scale factor is 1/3,
  // since each inner unit is 1/3 of an outer unit.
  //
  // As a consequence of this, you can multiply by an inner scale factor to
  // convert inner units to outer units, or divide by it to convert outer units
  // to inner units.
  let outer_pane = wld.panes[outer_id];
  for (let inl of outer_pane.inlays) {
    if (inl.at[0] == pos[0] && inl.at[1] == pos[1]) {
      return inlay_scale_factor(inl);
    }
  }
  return NaN;
}

export function inlay_scale_factor(inl) {
  // Returns the scale factor for an inlay.
  return inl.size / PANE_SIZE;
}

export function inlay_bounds(inl) {
  return [inl.at[0], inl.at[1], inl.at[0] + inl.size, inl.at[1] + inl.size];
}

export function outer_coord(x, base, sf) {
  // Given an inlay base coordinate and a scale factor, transforms the given
  // value into an outer-coordinate value.
  return base + x * sf;
}

export function inner_coord(x, base, sf) {
  // Given an inlay base coordinate and a scale factor, transforms the given
  // value into an inner-coordinate value.
  return (x - base) / sf;
}

export function outer_edges(wld, pane_id, loc, inner_edges) {
  // Given inner edges relative to given location of the given pane, computes
  // edges relative to the base pane.
  let lpos = loc[0];
  let sf = get_scale_factor(wld, pane_id, lpos);
  return [
    outer_coord(inner_edges[0], lpos[0], sf),
    outer_coord(inner_edges[1], lpos[1], sf),
    outer_coord(inner_edges[2], lpos[0], sf),
    outer_coord(inner_edges[3], lpos[1], sf)
  ];
}

export function outer_position(wld, pane_id, loc, inner_pos) {
  // Given a position in an inner pane (the one at the given location in the
  // given base pane), computes position in the base pane.
  let lpos = loc[0];
  let sf = get_scale_factor(wld, pane_id, lpos);
  return [
    outer_coord(inner_pos[0], lpos[0], sf),
    outer_coord(inner_pos[1], lpos[1], sf)
  ];
}

export function init_world(name, seed) {
  // Initializes a new empty world with the given name (fails with an error in
  // the console if that name is already in use), and returns the newly created
  // world.
  if (seed == undefined) {
    seed = 17; // TODO: RNG here?
  }
  if (WORLDS.hasOwnProperty(name)) {
    error("Tried to re-initialize world named '" + name + "'.");
    return undefined;
  }
  let result = {
    "name": name,
    "seed": seed,
    "panes": {},
    "entities": {},
    "biomes": {},
    "next_pane_id": 0,
    "next_entity_id": 0,
  };
  WORLDS[name] = result;
  return result;
}

export function by_name(name) {
  return WORLDS[name];
}

export function create_pane_id(wld) {
  let result = wld.next_pane_id;
  wld.next_pane_id += 1;
  return result;
}

export function create_entity_id(wld) {
  let result = wld.next_entity_id;
  wld.next_entity_id += 1;
  return result;
}

// TODO: More arguments?
export function create_pane(wld, id) {
  // Creates a new pane with the given ID (or with a new ID for the given
  // world) and adds it to the given world, possibly replacing any previous
  // pane that had the same ID (a warning will be issued in that case). Returns
  // the created (empty) pane.
  if (id == undefined) {
    id = create_pane_id(wld)
  }
  if (wld.panes.hasOwnProperty(id)) {
    console.warn("create_pane replacing pane with ID " + id);
  }
  // TODO: non-fake version of this
  var result = {
    "world": wld.name,
    "id": id,
    "blocks": [],
    "parents": {},
    "inlays": [],
    "entities": {},
  }
  for (let i = 0; i < PANE_SIZE * PANE_SIZE; ++i) {
    result.blocks.push(blocks.CHAOS);
  }

  wld.panes[id] = result;
  return result;
}

export function canonical_parent(pane) {
  // Returns the canonical parent pane ID for the given pane. Returns undefined
  // only for panes that have no parents.
  let parents = Object.keys(pane.parents);
  if (parents.length > 0) {
    return parents[0];
  } else {
    console.warn("Pane '" + pane.id + "' has no parents.");
    return undefined;
  }
}

export function canonical_inlay(pane) {
  // Returns the inlay location of the given pane within its canonical parent.
  let p = canonical_parent(pane);
  if (p == undefined) {
    return undefined;
  }
  let candidates = WORLDS[pane.world].panes[p].inlays;
  for (let inl of candidates) {
    if (inl.id == pane.id) {
      return inl;
    }
  }
}

// TODO: More arguments?
export function create_entity(wld, id) {
  // Creates a new entity with the given ID (or with a new ID for the given
  // world) and adds it to the given world, possibly replacing any previous
  // pane that had the same ID (a warning will be issued in that case). Returns
  // the created (blank) entity.
  if (id == undefined) {
    id = create_entity_id(wld)
  }
  if (wld.entities.hasOwnProperty(id)) {
    console.warn("create_entity replacing entity with ID " + id);
  }
  // TODO: non-fake version of this
  var result = {
    "world": wld.name,
    "id": id,
    "size": 0.5,
    "appearance": {
      "color": "#429",
      "border_color": "#63b",
    },
    "home": undefined,
    "trace": [], // TODO: starting position?
    "pos": [PANE_SIZE/2, PANE_SIZE/2],
    "vel": [0, 0],
    "speed": 1.5 / 1000,
    "ctl": {"x": 0, "y": 0, "jump": false },
    "capabilities": {},
  }

  wld.entities[id] = result;
  return result;
}

export function assign_biome(wld, id, biome) {
  // Assigns the given pane to the given biome in the given world.
  if (!wld.biomes.hasOwnProperty(biome)) {
    wld.biomes[biome] = {};
  }
  wld.biomes[biome][id] = true;
}

export function block_at(pane, pos) {
  return pane.blocks[pos[0] + pos[1] * PANE_SIZE];
}

export function set_block(pane, pos, block_id) {
  // Overwrites a block in a pane.
  pane.blocks[pos[0] + pos[1] * PANE_SIZE] = block_id;
}

export function fill_pane(pane, block_id) {
  // Overwrites every block in a pane.
  for (let i = 0; i < PANE_SIZE * PANE_SIZE; ++i) {
    pane.blocks[i] = block_id;
  }
}

export function set_border(pane, block_id) {
  // Overwrites all of the blocks around the edges of a pane.
  for (let x = 0; x < PANE_SIZE; ++x) {
    for (let y = 0; y < PANE_SIZE; ++y) {
      if (x == 0 || y == 0 || x == PANE_SIZE - 1 || y == PANE_SIZE - 1) {
        set_block(pane, [x, y], block_id);
      }
    }
  }
}

export function inset_pane(parent_pane, pos, child_pane, size) {
  // Adds a reference within the parent pane to the child pane, setting it at
  // the given location and creating it with the given size. References should
  // ideally not be overlapped.
  //
  // Blocks underneath the inlay are set to CHAOS.
  parent_pane.inlays.push(
    {"at": pos.slice(), "id": child_pane.id, "size": size}
  );
  child_pane.parents[parent_pane.id] = true;
  let x = pos[0];
  let y = pos[1];
  for (let xx = x; xx < x + size; ++xx) {
    for (let yy = y; yy < y + size; ++yy) {
      set_block(parent_pane, [xx, yy], blocks.CHAOS);
    }
  }
}

export function set_home(pane, pos, entity) {
  // Sets the home of the given entity, and makes an entry for it in the given
  // pane. Replaces the entity's old home if there was one.
  entity.home = { "world": pane.world, "pane": pane.id, "pos": pos };
}

export function current_pane(entity) {
  // Returns the entity's current pane.
  if (entity.trace.length > 0) {
    return WORLDS[entity.world].panes[entity.trace[entity.trace.length - 1][1]];
  } else {
    return undefined;
  }
}

export function place_entity(entity, pid, pos) {
  // Places the given entity onto the given pane in the given position. Resets
  // the entity's trace.
  let origin_pane = current_pane(entity);
  if (origin_pane != undefined) {
    delete origin_pane.entities[entity.id];
  }
  entity.trace = [ [undefined, pid] ];
  entity.pos = pos.slice();
  current_pane(entity).entities[entity.id] = true;
}

export function warp_home(entity) {
  // Warps the given entity back to its home, erasing any trace it might have
  // built up.
  place_entity(entity, entity.home.pane, entity.home.pos);
}

export function fill_test_pane(wld, id) {
  // Fills out a test pane which inlays itself to form an endless cave.
  var pane = wld.panes[id];
  fill_pane(pane, blocks.AIR);
  set_border(pane, blocks.DIRT);
  for (let x = 0; x < PANE_SIZE; ++x) {
    for (let y = 0; y < 3; ++y) {
      set_block(pane, [x, y], blocks.DIRT);
    }
    for (let y = 20; y < PANE_SIZE; ++y) {
      set_block(pane, [x, y], blocks.DIRT);
    }
  }

  for (let y = 2; y < 20; ++y) {
    set_block(pane, [0, y], blocks.AIR);
  }

  for (let x = 1; x < 14; ++x) {
    for (let y = 3; y < 10; ++y) {
      if (x - 1 > y - 3 && x < 6 && y < 4) {
        set_block(pane, [x, y], blocks.DIRT);
      } else if (x - 6 >= y - 3) {
        set_block(pane, [x, y], blocks.ROCK);
      }
    }
  }

  for (let x = 14; x < PANE_SIZE - 1; ++x) {
    for (let y = 3; y < 11; ++y) {
      set_block(pane, [x, y], blocks.ROCK);
    }
  }

  for (let x = 18; x < 23; ++x) {
    for (let y = 3; y < 12; ++y) {
      if (x - 18 > y - 3 || x - 18 > 12 - y) {
        set_block(pane, [x, y], blocks.DIRT);
      }
    }
  }

  for (x = 14; x < 20; ++x) {
    set_block(pane, [x, 11], blocks.DIRT);
  }

  for (x = 11; x < 15; ++x) {
    set_block(pane, [x, 19], blocks.DIRT);
  }

  for (y = 19; y < 24; ++y) {
    for (x = 1; x < 12; ++x) {
      if (x - 1 >= 24 - y && 13 - x >= 24 - y) {
        set_block(pane, [x, y], blocks.ROCK);
      }
    }
    for (x = 11; x < 22; ++x) {
      if (x - 10 >= 24 - y && 21 - x >= y - 19) {
        set_block(pane, [x, y], blocks.ROCK);
      }
    }
  }

  // 点滅 blocks
  set_block(pane, [8, 16], blocks.by_id("点滅㈠"));
  set_block(pane, [10, 15], blocks.by_id("点滅㈡"));
  set_block(pane, [9, 13], blocks.by_id("点滅㈢"));

  inset_pane(pane, [15, 12], pane, 8);
}

export function grid_bb(pos, size) {
  // Returns the bounding box for a square region of a grid.
  return [
    pos[0],
    pos[1],
    pos[0] + size,
    pos[1] + size
  ];
}

export function find_context(wld, edges, trace) {
  // Finds a pane that's two panes above the end of the given trace,
  // hallucinating extra context when necessary. Returns undefined for empty
  // traces, otherwise it returns a [pane_id, edges, relative_depth] pair,
  // where relative_depth will be 2 unless a parent-less pane blocks
  // hallucination.
  let target_loc = undefined;
  let target_pid = undefined;
  let depth_adjust = 0;
  for (let i = trace.length - 1; i > trace.length - 4; --i) {
    if (trace[i] == undefined) {
      if (target_pid == undefined) {
        // No basis from which to hallucinate.
        console.warn("Empty trace has no context.");
        return undefined;
      } else {
        depth_adjust += 1;
        let tpane = wld.panes[target_pid];
        let parent_pane = wld.panes[canonical_parent(tpane)];
        let cinl = canonical_inlay(tpane);
        let lpos = cinl.at;
        let sf = get_scale_factor(wld, parent_pane.id, lpos);
        let new_edges = [
          outer_coord(edges[0], lpos[0], sf),
          outer_coord(edges[1], lpos[1], sf),
          outer_coord(edges[2], lpos[0], sf),
          outer_coord(edges[3], lpos[1], sf)
        ];
        edges = new_edges;
        target_pid = parent_pane.id;
        target_loc = [lpos, target_pid];
      }
    } else if (target_pid != undefined) {
      depth_adjust += 1;
      let lpos = target_loc[0];
      let sf = get_scale_factor(wld, trace[i][1], lpos);
      let new_edges = [
        outer_coord(edges[0], lpos[0], sf),
        outer_coord(edges[1], lpos[1], sf),
        outer_coord(edges[2], lpos[0], sf),
        outer_coord(edges[3], lpos[1], sf)
      ];
      edges = new_edges;
      target_loc = trace[i];
      target_pid = target_loc[1];
    } else {
      target_loc = trace[i];
      target_pid = target_loc[1];
    }
  }
  return [target_pid, edges, depth_adjust];
}