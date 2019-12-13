// structure.js
// World layout in terms of graph structure. The overall layout consists of one
// top-level circular five-strand braid for each biome, where the strands
// frequently interconnect and also have finite-length side chains which loop
// back and/or connect between strands.
//
// Each top-level braid has length 2^27, and connects to three other braids of
// the same biome at increasingly infrequent intervals. The four braids each
// have this connection structure, so all four braids for each biome
// interconnect.
//
// Each biome braid also regularly connects to braids from other biomes based
// on the biome connectivity rules from biomes.js.

import * as world from "./world";
import * as rng from "./rng";
import * as anarchy from "./anarchy";
import * as biomes from "./biomes";

// How many links can fit in a single node?
export var NODE_LINK_CAPACITY = 3

// Length and number of strands for each primary braid
export var BRAID_LENGTH = Math.pow(2, 27);
export var BRAID_STRANDS = 5;

// Size of each cohort and super-cohort group:
export var COHORT_SIZE = 6
export var GROUP_SIZE = 11

// Periods for connections between biome braids (in groups):
export var BRAID_SHORT_INTERCONNECT_PERIOD = 15;
export var BRAID_MEDIUM_INTERCONNECT_PERIOD = 47;
export var BRAID_LONG_INTERCONNECT_PERIOD = 109;

// Period for connections to other biomes (in groups):
export var BIOME_INTERCONNECT_PERIOD = 4;

// How often sidechains are attached: individual cohort capacity, and base/max
// number of sidechains to distribute.
export var COHORT_SIDECHAIN_CAPACITY = 2;
export var BASE_SIDECHAINS_PER_GROUP = 3; // ~1 per 4 cohorts
export var MAX_SIDECHAINS_PER_GROUP = 10; // almost 1 per cohort

// How far for backlinks to attach backwards on the same axis (in cohorts):
export var MIN_BACKLINK_SKIP = 1;
export var MAX_BACKLINK_RANGE = 3;

// How far strand-connector links attach forward or backwards on the
// destination strand (in cohorts) and how often strand connections happen (in
// groups):
export var STRAND_CONNECTOR_RANGE = 3;
export var STRAND_CONNECTOR_PERIOD = 3;

// The amount of variance in braid connector source and destination points (in
// cohorts).
export var BRAID_CONNECTOR_RANGE = GROUP_SIZE*2;

// How far biome connectors link forward or backward in the corresponding
// strand (in cohorts):
export var BIOME_CONNECTOR_RANGE = GROUP_SIZE;

// How long side chains can be (in nodes):
export var SIDECHAIN_BASE_LENGTH = 3;
export var SIDECHAIN_MAX_LENGTH = 27;

// Number of links per cohort:
export var MAX_EXTRA_BACKLINKS_PER_GROUP = 5; // +GROUP_SIZE for traversibility
export var BACKLINK_DIST_ROUGHNESS = 0.3;
export var MAX_EXTRA_SIDELINKS_PER_GROUP = 20; // 33 base for traversibility
// TODO: HERE
export var MAX_DOWNLINKS_PER_GROUP = 12;
export var DOWNLINK_DIST_ROUGHNESS = 0.8;

// Roughness within cohort:
export var COHORT_LINK_ROUGHNESS = 0.3;

// Number of virtual sideways branches for each cohort:
export var BRANCH_DIMENSIONS = 3;

export function node_hash(node_coords) {
  /*
  Turns node coordinates into a hash value.
  */
  let result = 0;
  for (let coord of node_coords) {
    result ^= (coord + 1198230) * 31;
  }
  return result;

export function group_seed(node_coords, seed) {
  /*
  Per-group seed construction.
  */
  for (let i = 0; i < node_coords.length-1; ++i) {
    seed = anarchy.prng(seed, node_coords[i];
  }
  let group = anarchy.cohort(
    node_coords[node_coords.length-1],
    GROUP_SIZE * COHORT_SIZE
  );
  return anarchy.prng(seed, group);

export function cohort_seed(node_coords, seed) {
  /*
  Per-cohort seed construction.
  */
  for (let i = 0; i < node_coords.length-1; ++i) {
    seed = anarchy.prng(seed, node_coords[i];
  }
  let cohort = anarchy.cohort(
    node_coords[node_coords.length-1],
    COHORT_SIZE
  );
  return anarchy.prng(seed, cohort);

export function group_extra_link_quantities(node_coords, seed) {
  /*
  Computes group extra link parameters for the group containing the given node.
  */

  // Get specific seed:
  seed = group_seed(node_coords, seed);

  // Random extra backlinks, uplinks, sidelinks, and downlinks
  let backlinks = anarchy.idist(seed, 0, MAX_EXTRA_BACKLINKS_PER_GROUP+1);
  seed = anarchy.lfsr(seed);
  let uplinks = anarchy.idist(seed, 0, MAX_UPLINKS_PER_GROUP+1);
  seed = anarchy.lfsr(seed);
  let sidelinks = anarchy.idist(seed, 0, MAX_EXTRA_SIDELINKS_PER_GROUP+1);
  seed = anarchy.lfsr(seed);
  let downlinks = anarchy.idist(seed, 0, MAX_DOWNLINKS_PER_GROUP+1);
  return [backlinks, uplinks, sidelinks, downlinks];

export function cohort_link_quantities(node_coords, seed) {
  /*
  Computes number of uplinks, sidelinks, and downlinks for the given cohort at
  the given depth.
  */

  // Get cohort:
  let cohort = anarchy.cohort(node_coords[-1], COHORT_SIZE);

  // Get group and in-group index:
  let group_ingroup = anarchy.cohort_and_inner(cohort, GROUP_SIZE)
  let group = group_ingroup[0];
  let ingroup = group_ingroup[1];

  // Group and cohort seeds:
  let grseed = group_seed(node_coords, seed);

  // Use raw seed here:
  let gr_extras = group_extra_link_quantities(node_coords, seed);

  // Base + random backlinks, uplinks, sidelinks, and downlinks
  let back = 1 + anarchy.distribution_portion(
    ingroup,
    gr_extras[0],
    GROUP_SIZE,
    COHORT_SIZE,
    BACKLINK_DIST_ROUGHNESS,
    grseed
  );
  let up = anarchy.distribution_portion(
    ingroup,
    gr_extras[1],
    GROUP_SIZE,
    COHORT_SIZE,
    UPLINK_DIST_ROUGHNESS,
    grseed
  );
  let side = BRANCH_DIMENSIONS + anarchy.distribution_portion(
    ingroup,
    gr_extras[2],
    GROUP_SIZE,
    COHORT_SIZE,
    SIDELINK_DIST_ROUGHNES,
    grseed
  );
  let down = anarchy.distribution_portion(
    ingroup,
    gr_extras[3],
    GROUP_SIZE,
    COHORT_SIZE,
    DOWNLINK_DIST_ROUGHNESS,
    grseed
  )

  return [back, up, side, down];

export function node_link_quantities(node_coords, seed) {
  /*
  Computes backlinks, uplinks, sidelinks (primary and secondary), and downlinks
  for a single node. Respects NODE_LINK_CAPACITY.
  */

  // Get cohort info
  let cohort_and_inner = anarchy.cohort_and_inner(node_coords[-1], COHORT_SIZE);
  let cohort = cohort_and_inner[0]
  let inner = cohort_and_inner[1]

  // Cohort seed
  let chseed = cohort_seed(node_coords, seed);

  // Link quantities for this cohort
  let ch_links = cohort_link_quantities(node_coords, seed);
  let total_links = ch_links[0] + ch_links[1] + ch_links[2] + ch_links[3];
  let ch_back = ch_links[0];
  let ch_up = ch_links[1];
  let ch_side = ch_links[2];
  let ch_down = ch_links[3];

  // Distribute links across cohort together
  let links_before = anarchy.distribution_prior_sum(
    inner,
    total_links,
    COHORT_SIZE,
    NODE_LINK_CAPACITY,
    COHORT_LINK_ROUGHNESS,
    chseed
  );
  let links_here = anarchy.distribution_portion(
    inner,
    total_links,
    COHORT_SIZE,
    NODE_LINK_CAPACITY,
    COHORT_LINK_ROUGHNESS,
    chseed
  );
  // Local link quantities:
  let back = 0
  let up = 0
  let side_indices = []
  let down = 0
  // Shuffle link identities among the total links distributed:
  // (Same cohort seed for whole loop for consistent shuffle)
  for (
    let link_index = links_before;
    link_index < links_before + links_here;
    ++link_index
  ) {
    let shuf_index = anarchy.cohort_shuffle(link_index, total_links, chseed);
    if (shuf_index < ch_back) {
      back += 1;
    } else if (shuf_index < ch_up) {
      up += 1;
    } else if (shuf_index < ch_up + ch_side) {
      side_indices[side_indices.length] = shuf_index - ch_up;
    } else {
      down += 1;
    }
  }

  // Convert backlinks to uplinks if we're not on the original axis and the
  // backlink would take us back before the axis start.
  if (cohort - MIN_BACKLINK_SKIP - 1 < 0) {
    if (len(node_coords) >= 3) {
      up += back;
      back = 0;
    }
  }

  if (back + up + len(side_indices) + down > NODE_LINK_CAPACITY) {
    console.log(
      "Warning: NODE_LINK_CAPACITY exceeded: "
    + back + " + "
    + up + " + "
    + side_indices.length + " + "
    + down + " > "
    + NODE_LINK_CAPACITY
    );
  }
  return [back, up, side_indices, down];

export function links(node_coords, seed) {
  /*
  Given node coordinates returns a list of node coordinates that are linked
  to from this node.
  */
  let nd_seed = seed ^ node_hash(node_coords);
  let result = [];

  // All nodes link forward along the current branch:
  let fwd = node_coords.slice();
  fwd[fwd.length-1] += 1;
  result[result.length] = fwd;

  // Compute number of back, up, side, and down links:
  let link_quantities = node_link_quantities(node_coords, seed);
  let back = link_quantities[0];
  let up = link_quantities[1];
  let side_indices = link_quantities[2];
  let down = link_quantities[3];

  // Convert uplinks to backlinks if we have nowhere to link upwards:
  if (node_coords.length <= 2) {
    back += up;
    up = 0;
  }

  // Backlinks:
  for (let i = 0; i < back; ++i) {
    let target = anarchy.idist(
      nd_seed,
      -COHORT_SIZE * MAX_BACKLINK_RANGE,
      -COHORT_SIZE * MIN_BACKLINK_SKIP
    );
    nd_seed = anarchy.lfsr(nd_seed);
    let target_coords = node_coords.slice();
    target_coords[target_coords.length - 1] += target;
    result[result.length] = target_coords;
  }

  // Uplinks:
  for (let i = 0; i < up; ++i) {
    let target = anarchy.idist(
      nd_seed,
      -COHORT_SIZE * UPLINK_RANGE,
      COHORT_SIZE * UPLINK_RANGE + 1
    );
    nd_seed = anarchy.lfsr(nd_seed);
    let target_coords = node_coords.slice(0, node_coords.length-2);
    target_coords[target_coords.length-1] *= COHORT_SIZE;
    target_coords[target_coords.length-1] += target;
    result[result.length] = target_coords;
  }

  // Sidelinks:
  for (let side_idx of side_indices) {
    if (Math.floor(side_idx / BRANCH_DIMENSIONS) == 0) {
      // A link to the first node in the given branch
      let target_coords = node_coords.slice();
      target_coords[target_coords.length-1] = anarchy.cohort(
        target_coords[target_coords.length-1],
        COHORT_SIZE
      );
      target_coords[target_coords.length] = side_idx % BRANCH_DIMENSIONS;
      target_coords[target_coords.length] = 0;
      result[result.length] = target_coords;
    } else {
      // A link to a random node near the start of the given branch
      let target = anarchy.idist(
        nd_seed,
        0,
        COHORT_SIZE * SECONDARY_SIDELINK_RANGE
      );
      nd_seed = anarchy.lfsr(nd_seed)
      let target_coords = node_coords.slice();
      target_coords[target_coords.length-1] = anarchy.cohort(
        target_coords[target_coords.length-1],
        COHORT_SIZE
      );
      target_coords[target_coords.length] = side_idx % BRANCH_DIMENSIONS;
      target_coords[target_coords.length] = target;
      result[result.length] = target_coords;
    }
  }

  // Downlinks:
  for (let i = 0; i < down; ++i) {
    let target = anarchy.idist(
      nd_seed,
      COHORT_SIZE * MIN_DOWNLINK_SKIP,
      COHORT_SIZE * MAX_DOWNLINK_RANGE
    );
    nd_seed = anarchy.lfsr(nd_seed)
    let target_coords = node_coords.slice();
    target_coords[target_coords.length-1] += target;
    result[result.length] = target_coords;
  }

  return result;
}

export var RC_DEEPER_PROB = 0.6;
export var RC_RANGE = 1e8;

export function random_node_coords(seed, max_depth, cohort_aligned) {
  /*
  Generates a random set of node coords with the given maximum depth. Unless
  cohort_aligned is given as False, it will be the first node in a cohort. Both
  max_depth and cohort_aligned are optional and default to 4 and true
  respectively.

  TODO: Respect pocket branches.
  */
  if (max_depth == undefined) {
    max_depth = 4;
  }
  if (cohort_aligned == undefined) {
    cohort_aligned = true;
  }
  let depth = 0
  while (anarchy.udist(seed) < RC_DEEPER_PROB && depth < max_depth) {
    seed = anarchy.lfsr(seed);
    depth += 1;
  }

  let result = [
    anarchy.idist(seed, 0, RC_RANGE+1)
  ];
  seed = anarchy.lfsr(seed);
  for (let i = 0; i < depth; ++i) {
    let last = result[result.length-1];
    result[result.length-1] = anarchy.cohort(last, COHORT_SIZE);
    result[result.length] = anarchy.idist(seed, 0, BRANCH_DIMENSIONS);
    seed = anarchy.lfsr(seed);
    if (i == depth-1 && cohort_aligned) {
      let target = anarchy.idist(seed, 0, Math.floor(RC_RANGE/COHORT_SIZE) + 1);
      seed = anarchy.lfsr(seed);
      result[result.length] = target * COHORT_SIZE;
    } else {
      result[result.length] = anarchy.idist(seed, 0, RC_RANGE+1);
      seed = anarchy.lfsr(seed);
    }
  }

  return result;
}

export function alpha(num) {
  /*
  Converts a number to a lowercase alphabetic value, mapping 0-9 to a-j and
  other characters to k-z.
  */
  let digits = "" + num;
  let result = '';
  for (let d of digits) {
    let n = d.charCodeAt(0);
    if ("0123456789".indexOf(d) < 0) {
      result += String.fromCharCode(107 + (n % 16)); // 97 + 10 = 107
    } else {
      result += String.fromCharCode(49 + n); // 49 + 48 ('0') = 97 ('a')
    }
  }
  return result;
}

export function nc_string(node_coords) {
  /*
  Converts node coordinates into a string.
  */
  let result = '';
  for (let n of node_coords) {
    let a = alpha(n);
    result += a;
    result += '_';
  }
  return result.slice(0, result.length-1);
}

export function find_connected_nodes(
  node_coords,
  seed,
  max_depth,
  visited
) {
  /*
  Finds nodes connected to a base node out to a given depth. Both max_depth and
  visited are optional, and visited should not be supplied manually.
  */
  if (max_depth == undefined) {
    max_depth = COHORT_SIZE*2
  }
  if (visited == undefined) {
    visited = new Set();
  }
  if (visited.has(nc_string(node_coords))) {
    return {};
  }
  let key = nc_string(node_coords);
  visited.add(key);
  let result = {};
  if (max_depth == 0) {
    return {};
  }
  let neighbors = links(node_coords, seed);
  result[key] = new Set();
  for (let neighbor of neighbors) {
    result[key].add(nc_string(neighbor));
    let further = find_connected_nodes(neighbor, seed, max_depth-1, visited);
    for (let source of Object.keys(further)) {
      if (!result.hasOwnProperty(source)) {
        result[source] = new Set();
      }
      for (let dest of further[source]) {
        result[source].add(dest);
      }
    }
  }
  return result;
}

export function alpha_encode(n) {
  /*
  Encodes a positive integer as a string of uppercase letters; A, B, C ... BA,
  BB, BC, ... etc.
  */
  let result = '';
  while (n > 25) {
    result = String.fromCharCode(65 + n % 26) + result;
    n = Math.floor(n / 26);
  }
  result = String.fromCharCode(65 + n % 26) + result;
  return result;
}

export function rename_graph(graph) {
  /*
  Simplifies graph names to one-letter names (erases structural information).
  */
  let n = 0;
  function next_node_name() {
    result = alpha_encode(n);
    n += 1;
    return result;
  }

  let assignments = {};
  let result = {};
  for (let source of graph) {
    if (!assignments.hasOwnProperty(source)) {
      assignments[source] = next_node_name();
    }
    if (!result.hasOwnProperty(assignments[source])) {
      result[assignments[source]] = new Set();
    }
    for (let dest of graph[source]) {
      if (!assignments.hasOwnProperty(dest)) {
        assignments[dest] = next_node_name();
      }
      result[assignments[source]].add(assignments[dest]);
    }
  }

  return result;
}
