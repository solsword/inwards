// generate.js
// World generation code.

import * as rng from "./rng";
import * as blocks from "./blocks";
import * as biomes from "./biomes";
import * as world from "./world";
import * as templates from "./templates";

export function seal_generation(pane, template) {
  // Marks a pane as generated (by the given template).
  pane.params.generated_by = template;
}

export function needs_generation(pane) {
  // Checks whether a pane still needs to be generated or not.
  return pane.params.generated_by == undefined;
}

export function generate_pane(wld, pid) {
  // Fills in an empty pane with content, obeying zone and biome rules.
  let air = blocks.by_id("air");
  let dirt = blocks.by_id("dirt");
  let stone = blocks.by_id("stone");

  let pane = wld.panes[pid];
  if (pane == undefined) {
    console.warn("generate_pane had to create its own pane!");
    pane = world.create_pane(wld, undefined, undefined, pid);
  }
  let zone = wld.zones[pane.zone];
  let biome = wld.biomes[zone.biome];

  // pick a template that fits
  let fits = [];
  let biome_templates = templates.T[biome.type];
  for (let k of Object.keys(biome_templates)) {
    let t = biome_templates[k];
    if (t.applicable_to(wld, pane)) {
      fits.push([k, t.generate]);
    }
  }
  let seed = rng.next(pane.params.seed + 572);
  if (fits.length == 0) {
    console.error("No matching templates for pane:");
    console.error(pane);
    seal_generation(pane, "<<error: no matching templates>>");
    return;
  }
  let chosen = fits[rng.select(0, fits.length - 1, seed)];
  chosen[1](wld, pane); // call generator function
  seal_generation(pane, chosen[0]); // mark as generated
}

export function fill_test_pane(wld, id) {
  // Fills out a test pane which inlays itself to form an endless cave.
  var pane = wld.panes[id];
  seal_generation(pane, "test_pane");
  world.fill_pane(pane, air);
  world.set_border(pane, dirt);
  for (let x = 0; x < PANE_SIZE; ++x) {
    for (let y = 0; y < 3; ++y) {
      world.set_block(pane, [x, y], dirt);
    }
    for (let y = 20; y < PANE_SIZE; ++y) {
      world.set_block(pane, [x, y], dirt);
    }
  }

  for (let y = 2; y < 20; ++y) {
    world.set_block(pane, [0, y], air);
  }

  for (let x = 1; x < 14; ++x) {
    for (let y = 3; y < 10; ++y) {
      if (x - 1 > y - 3 && x < 6 && y < 4) {
        world.set_block(pane, [x, y], dirt);
      } else if (x - 6 >= y - 3) {
        world.set_block(pane, [x, y], stone);
      }
    }
  }

  for (let x = 14; x < PANE_SIZE - 1; ++x) {
    for (let y = 3; y < 11; ++y) {
      world.set_block(pane, [x, y], stone);
    }
  }

  for (let x = 18; x < 23; ++x) {
    for (let y = 3; y < 12; ++y) {
      if (x - 18 > y - 3 || x - 18 > 12 - y) {
        world.set_block(pane, [x, y], dirt);
      }
    }
  }

  for (x = 14; x < 20; ++x) {
    world.set_block(pane, [x, 11], dirt);
  }

  for (x = 11; x < 15; ++x) {
    world.set_block(pane, [x, 19], dirt);
  }

  for (y = 19; y < 24; ++y) {
    for (x = 1; x < 12; ++x) {
      if (x - 1 >= 24 - y && 13 - x >= 24 - y) {
        world.set_block(pane, [x, y], stone);
      }
    }
    for (x = 11; x < 22; ++x) {
      if (x - 10 >= 24 - y && 21 - x >= y - 19) {
        world.set_block(pane, [x, y], stone);
      }
    }
  }

  // 点滅 blocks
  world.set_block(pane, [8, 16], blocks.by_id("点滅㈠"));
  world.set_block(pane, [10, 15], blocks.by_id("点滅㈡"));
  world.set_block(pane, [9, 13], blocks.by_id("点滅㈢"));

  world.inset_pane(pane, [15, 12], pane, 8);
}

export function fill_start_pane(wld, id) {
  // Fills out a start pane which inlays four panes from different biomes.
  var pane = wld.panes[id];
  seal_generation(pane, "start_pane");

  let air = blocks.by_id("air");
  let brick = blocks.by_id("brick");

  // air
  world.fill_pane(pane, air);

  // border
  world.set_border(pane, brick, 1);

  // openings at the top and bottom
  for (let x = 10; x <= 13; ++x) {
    world.set_block(pane, [x, 0], air);
    world.set_block(pane, [x, world.PANE_SIZE-1], air);
  }

  // arms from the sides
  for (let x = 0; x < world.PANE_SIZE; ++x) {
    for (let y = 9; y < 15; ++y) {
      if (x < 10 || x > 13) {
        world.set_block(pane, [x, y], brick);
      }
    }
  }

  // platforms for top/bottom access to each inlay
  world.set_block(pane, [9, 5], brick);
  world.set_block(pane, [10, 5], brick);
  world.set_block(pane, [13, 5], brick);
  world.set_block(pane, [14, 5], brick);
  world.set_block(pane, [9, 19], brick);
  world.set_block(pane, [10, 19], brick);
  world.set_block(pane, [13, 19], brick);
  world.set_block(pane, [14, 19], brick);

  // columns above and below
  for (let x = 11; x < 13; ++x) {
    for (let y = 0; y < world.PANE_SIZE; ++y) {
      if ((y >= 2 && y <= 3) || (y >= 7 && y <= 17) || (y >= 21 && y <= 22)) {
        world.set_block(pane, [x, y], brick);
      }
    }
  }

  // four new zones in four new biomes:
  let anchors = [
    [1, 1],
    [15, 1],
    [1, 15],
    [15, 15]
  ];
  let entrances = [
    ["right", 11],
    ["left", 11],
    ["right", 11],
    ["left", 11]
  ];
  for (let bt of biomes.START_BIOMES) {
    let biome = world.create_biome(wld, bt);
    let zone = world.create_zone(wld, biome.id, "cooridor");
    let anchor = anchors.pop();
    let ent = entrances.pop();
    let sub = world.create_pane(
      wld,
      {
        "seed": rng.sub_seed(pane.params.seed, anchor),
        "constraints": {
          "entrances": [ ent ]
        }
      },
      zone.id
    );
    world.inset_pane(pane, anchor, sub, 8);
  }
}

export function fill_funnel_pane(wld, id, sub) {
  // Fills out a funnel pane that leads both into itself and into the given
  // pane from the top.
  var pane = wld.panes[id];
  seal_generation(pane, "funnel_pane");

  let air = blocks.by_id("air");
  let stone = blocks.by_id("stone");
  let bridge = blocks.by_id("bridge");

  for (let x = 0; x < world.PANE_SIZE; ++x) {
    for (let y = 0; y < world.PANE_SIZE; ++y) {
      if (y > 14) {
        world.set_block(pane, [x, y], stone);
      } else if (x < y/3 || world.PANE_SIZE - 1 - x < y/3) {
        world.set_block(pane, [x, y], stone);
      } else {
        world.set_block(pane, [x, y], air);
      }
    }
  }

  for (let x = 5; x < 19; ++x) {
    world.set_block(pane, [x, 13], bridge);
  }

  world.set_block(pane, [11, 13], stone);
  world.set_block(pane, [12, 13], stone);
  world.set_block(pane, [11, 14], stone);
  world.set_block(pane, [12, 14], stone);

  world.inset_pane(pane, [5, 15], pane, 6);
  world.inset_pane(pane, [13, 15], wld.panes[sub], 6);
}
