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
  let isize = undefined;
  for (let inl of outer_pane.inlays) {
    if (inl.at[0] == loc[0] && inl.at[1] == loc[1]) {
      isize = inl.size;
      break;
    }
  }
  return isize / PANE_SIZE;
}

function outer_coord(x, base, sf) {
  // Given an inlay base coordinate and a scale factor, transforms the given
  // value into an outer-coordinate value.
  return base + x * sf;
}

function inner_coord(x, base, sf) {
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
    "entities": []
  }
  for (let i = 0; i < PANE_SIZE * PANE_SIZE; ++i) {
    result.blocks.push(blocks.CHAOS);
  }

  wld.panes[id] = result;
  return result;
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
    "home": undefined,
    "trace": [], // TODO: starting position?
    "pos": [PANE_SIZE/2, PANE_SIZE/2],
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
  // pane. Removes the entity's old home if there was one.
  if (entity.home != undefined) {
    // TODO: How to access old home given only ID?
    let homeworld = by_name(entity.home.world);
    let homepane = homeworld.panes[entity.home.pane]
    let idx = undefined;
    for (let i = 0; i < homepane.entities.length; ++i) {
      if (homepane.entities[i] == entity.id) {
        idx = i;
        break;
      }
    }
    if (idx != undefined) {
      homepane.entities.splice(idx, 1);
    }
  }
  pane.entities.push(entity);
  entity.home = { "world": pane.world, "pane": pane.id, "pos": pos };
}

export function warp_home(entity) {
  // Warps the given entity back to its home, erasing any trace it might have
  // built up.
  entity.trace = [ [undefined, entity.home.pane] ];
  entity.pos = entity.home.pos;
}

export function generate_test_pane(wld, id) {
  // Fills out a test pane which inlays itself to form an endless cave.
  var pane = wld.panes[id];
  fill_pane(pane, blocks.AIR);
  set_border(pane, blocks.DIRT);
  for (let x = 0; x < PANE_SIZE; ++x) {
    for (let y = 20; y < PANE_SIZE; ++y) {
      set_block(pane, [x, y], blocks.DIRT);
    }
  }
  for (let y = 12; y < 20; ++y) {
    set_block(pane, 0, y, blocks.AIR);
  }

  for (let x = 14; x < PANE_SIZE; ++x) {
    for (let y = 0; y < PANE_SIZE; ++y) {
      set_block(pane, [x, y], blocks.STONE);
    }
  }

  inset_pane(pane, 14, 12, pane, 8);
}

export function place_entity(entity, loc, pos) {
  // Reset's the given entity's location and position to the given values.
  entity.loc = loc;
  entity.pos = pos;
  pane.entities.push(entity);
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
