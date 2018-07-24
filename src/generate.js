// generate.js
// World generation code.

import * as blocks from "./blocks";
import * as world from "./world";
import * as templates from "./templates";

function generate_pane(wld, pid) {
  // Fills in an empty pane with content, obeying zone and biome rules.
  let pane = wld.panes[pid];
  if (pane == undefined) {
    console.warn("generate_pane had to create its own pane!");
    pane = world.create_pane(wld, undefined, pid);
  }
  let zone = wld.zones[pane.zone];
  let biome = wld.biomes[zone.biome];
}
