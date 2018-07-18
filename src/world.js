// world.js
// World generation & representation code

import * as blocks from blocks;

// Constants
export var PANE_SIZE = 24;

// Globals
export var WORLD = null;

export function outer_edges(pane_id, loc, inner_edges) {
  // Given inner edges relative to given location of the given pane, computes
  // edges relative to the base pane.
  // TODO: HERE
}

export function outer_position(pane_id, loc, inner_pos) {
  // Given a position in an inner pane (the one at the given location in the
  // given base pane), computes position in the base pane.
  // TODO: HERE
}

export function outer_scale(pane_id, loc, inner_pos) {
  // Given a scale relative to an inner pane (the one at the given location in
  // the given base pane), computes an equivalent scale relative to the base
  // pane.
  // TODO: HERE
}

export function init_world() {
  WORLD = {
    "panes": {},
    "biomes": {},
    "next_id": 0,
  };
}

export function create_pane_id(world) {
  let result = world.next_id;
  world.next_id += 1;
  return result;
}

// TODO: More arguments?
export function create_pane(world, id) {
  // Creates a new pane with the given ID (or with a new ID for the given
  // world) and adds it to the given world, possibly replacing any previous
  // pane that had the same ID (a warning will be issued in that case). Returns
  // the created (empty) pane.
  if (id == undefined) {
    id = create_pane_id(world)
  }
  if (world.panes.hasOwnProperty(id)) {
    console.warn("create_pane replacing pane with ID " + id);
  }
  // TODO: non-fake version of this
  var result = {
    "id": id,
    "blocks": [],
    "inlays": [],
    "entities": []
  }
  for (let i = 0; i < PANE_SIZE; ++i) {
    blocks.push(BLOCKS.CHAOS);
  }

  world.panes[id] = result;
  return result;
}

export function assign_biome(world, id, biome) {
  // Assigns the given pane to the given biome in the given world.
  if (!world.biomes.hasOwnProperty(biome)) {
    world.biomes[biome] = {};
  }
  world.biomes[biome][id] = true;
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

export function inset_pane(parent_pane, pos, child_id, size) {
  // Adds a reference within the parent pane to the child pane, setting it at
  // the given location and creating it with the given size. References should
  // ideally not be overlapped.
  //
  // Blocks underneath the inlay are set to CHAOS.
  parent_pane.inlays.push({"at": pos.slice(), "id": child_id, "size": size});
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
    let homepane = homeworld.panes[entity.home.pane]
    for (let i = 0; i < 
  }
  pane.entities.push(entity);
  entity.home = { "pane": pane.id, "pos": pos };
}

export function generate_test_pane(world, id) {
  // Fills out a test pane which inlays itself to form an endless cave.
  var pane = world.panes[id];
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

  inset_pane(pane, 14, 12, id, 8);
}

export function place_entity(entity, loc, pos) {
  // Reset's the given entity's location and position to the given values.
  entity.loc = loc;
  entity.pos = pos;
  pane.entities.push(entity);
}
