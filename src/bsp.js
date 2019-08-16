// bsp.js
// Randomized binary space partition graphs

import * as rng from "./rng";
import * as world from "./world";

// Default minimum node size for random BSP graphs
export var DEFAULT_MIN_SIZE = 4;

// Default probability of adding edges that create a cycle when subdividing
// nodes in a BSP graph
export var DEFAULT_CYCLE_PROBABILITY = 0.6;

// Default probability of pruning a node with prune_bsp
export var DEFAULT_PRUNE_FRACTION = 0.5;

export function bsp_graph(seed, min_size, cycle_prob) {
  // Creates a random binary space partition graph for a pane. Each node in the
  // graph covers some finite region of a pane, not smaller than min_size in
  // either dimension, and not larger than 2*min_size. Each node also has edges
  // to some of its neighboring nodes, potentially in ways that create cycles.
  // All three arguments are optional.
  //
  // If cycle_prob is 0, the graph will be a tree, and if cycle_prob is 1, the
  // graph will include every possible edge. In either case, the graph will
  // always be fully connected.
  if (min_size == undefined) { min_size = DEFAULT_MIN_SIZE; }
  if (cycle_prob == undefined) { cycle_prob = DEFAULT_CYCLE_PROBABILITY; }
  if (seed == undefined) { seed = pane.params.seed + 897239182; }

  let graph = {
    "seed": seed,
    "nodes": {
      0: {
        "id": 0,
        "left": 0,
        "right": world.PANE_SIZE - 1,
        "top": 0,
        "bottom": world.PANE_SIZE - 1,
      }
    },
    "edges": {}
  };

  finish_bsp(graph, min_size, cycle_prob); // TODO: Preserve list?

  return graph;
}

export function finish_bsp(graph, min_size, cycle_prob, preserve) {
  // Repeatedly applies the subdivide function to the given random BSP until no
  // further subdivisions are possible. Returns the original graph (but
  // modifications will have been applied). The preserve argument is optional
  // and should be a Set of node IDs that will be left undivided.
  if (min_size == undefined) { min_size = DEFAULT_MIN_SIZE; }
  if (cycle_prob == undefined) { cycle_prob = DEFAULT_CYCLE_PROBABILITY; }

  let seed = graph.seed;

  let result = true;
  while (result) {
    result = subdivide(graph, min_size, cycle_prob, preserve, seed);
    seed = rng.next(seed);
  }

  return graph;
}

export function subdivide(graph, min_size, cycle_prob, preserve, seed) {
  // Incrementally refines a random bsp_graph by subdividing a random node in
  // the graph. Modifies the graph given, and returns true, or returns false
  // and does nothing if there aren't any nodes that can be divided. The
  // optional preserve argument should be a Set of node IDs; those nodes will
  // not be divided.
  if (seed == undefined) { seed = graph.seed; }
  if (min_size == undefined) { min_size = DEFAULT_MIN_SIZE; }
  if (cycle_prob == undefined) { cycle_prob = DEFAULT_CYCLE_PROBABILITY; }
  if (preserve == undefined) { preserve = new Set(); }

  // figure out which nodes can be divided:
  let candidates = [];
  for (let id of Object.keys(graph.nodes)) {
    if (preserve.has(+id)) { continue; } // can't divide preserved nodes:
    let node = graph.nodes[id];
    let width = node.right - node.left + 1;
    let height = node.bottom - node.top + 1;
    if (width >= 2*min_size || height >= 2*min_size) {
      // big enough to divide in at least one direction:
      candidates.push(id);
    }
  }
  
  if (candidates.length == 0) { return false; } // nothing left to divide

  // Pick a target:
  let target = candidates[rng.select(0, candidates.length - 1, seed)];
  seed = rng.next(seed);

  let node = graph.nodes[target];
  let width = node.right - node.left + 1;
  let height = node.bottom - node.top + 1;
  let horiz = false;
  if (width >= 2*min_size && height >= 2*min_size) {
    horiz = rng.flip(seed, 0.5);
    seed = rng.next(seed);
  } else if (height >= 2*min_size) {
    horiz = true;
  } // else leave it at the false default

  let first, second;
  if (horiz) { // dividing horizontally
    let min = node.top + min_size;
    let max = node.bottom - min_size + 1;
    let div = rng.select(min, max, seed);
    seed = rng.next(seed);
    first = {
      "id": first_child_id(target),
      "left": node.left,
      "right": node.right,
      "top": node.top,
      "bottom": div - 1
    };
    second = {
      "id": second_child_id(target),
      "left": node.left,
      "right": node.right,
      "top": div,
      "bottom": node.bottom
    };
  } else { // dividing vertically
    let min = node.left + min_size;
    let max = node.right - min_size + 1;
    let div = rng.select(min, max, seed);
    seed = rng.next(seed);
    first = {
      "id": first_child_id(target),
      "left": node.left,
      "right": div - 1,
      "top": node.top,
      "bottom": node.bottom
    };
    second = {
      "id": second_child_id(target),
      "left": div,
      "right": node.right,
      "top": node.top,
      "bottom": node.bottom
    };
  }

  // find edges that connected to the old node:
  let connected = list_neighbors(graph, target);

  for (let nbid of connected) {
    let nb_node = graph.nodes[nbid];
    let nb_first = is_adjacent(first, nb_node);
    let nb_second = is_adjacent(second, nb_node);

    if (nb_first && nb_second) { // connected to both; pick one and maybe both
      // Randomly connect to one of the two:
      let cf = rng.flip(seed, 0.5);
      seed = rng.next(seed);
      if (cf) {
        add_edge(graph, nbid, first.id);
      } else {
        add_edge(graph, nbid, second.id);
      }
      // Flip to see if we connect to the other to form a cycle:
      if (rng.flip(seed, cycle_prob)) {
        if (cf) {
          add_edge(graph, nbid, second.id);
        } else {
          add_edge(graph, nbid, first.id);
        }
      }
      seed = rng.next(seed);
    } else if (nb_first) { // only connected to first child: link it
      add_edge(graph, nbid, first.id);
    } else if (nb_second) { // only connected to second child: link it
      add_edge(graph, nbid, second.id);
    } else { // shouldn't be possible
      console.error(
        "Connected node isn't adjacent to either split!",
        graph,
        target,
        connected,
        nbid
      );
    }

    // Remove this (defunct) edge from the graph
    remove_edge(graph, nbid, target);
  }

  // Finally, add link between the two new nodes we're creating:
  add_edge(graph, first.id, second.id);

  // Add the nodes to the graph:
  add_node(graph, first);
  add_node(graph, second);

  // Remove the node that got split:
  remove_node(graph, target);

  // We're done and divided a node, so we return true:
  return true;
}

// Binary tree indexing pattern means we don't need a counter to create new IDs:
export function first_child_id(id) { return 2*(+id) + 1; }
export function second_child_id(id) { return 2*(+id) + 2; }

export function list_neighbors(graph, id) {
  // Returns an array of the ID of each node connected to the node with the
  // given ID. Just checks edges of the graph.
  let connected = [];
  id = +id;
  for (let fr of Object.keys(graph.edges)) {
    fr = +fr;
    if (fr < id) {
      if (graph.edges[fr].has(id)) {
        connected.push(fr);
      }
    } else if (fr == id) {
      for (let to of graph.edges[fr]) {
        connected.push(+to);
      }
    } // else nothing; accounted for in else if case
  }
  return connected;
}

export function is_adjacent(nodeA, nodeB) {
  // Checks the edges of the given nodes (not IDs) and returns true if they're
  // adjacent. Overlapping nodes (which shouldn't exist) are not adjacent.
  let adj_vert = false;
  let adj_horiz = false;
  let ov_vert = false;
  let ov_horiz = false;
  if (nodeA.bottom == nodeB.top - 1 || nodeA.top == nodeB.bottom + 1) {
    adj_vert = true;
  }
  if (nodeA.left == nodeB.right + 1 || nodeA.right == nodeB.left - 1) {
    adj_horiz = true;
  }
  if (nodeA.bottom >= nodeB.top && nodeA.top <= nodeB.bottom) {
    ov_vert = true;
  }
  if (nodeA.left <= nodeB.right && nodeA.right >= nodeB.left) {
    ov_horiz = true;
  }
  return (adj_vert && ov_horiz) || (adj_horiz && ov_vert);
}

export function add_edge(graph, fr, to) {
  fr = +fr;
  to = +to;
  // Adds an edge between the given node IDs.
  if (fr < to) {
    if (!graph.edges.hasOwnProperty(fr)) {
      graph.edges[fr] = new Set();
    }
    graph.edges[fr].add(to);
  } else {
    if (!graph.edges.hasOwnProperty(to)) {
      graph.edges[to] = new Set();
    }
    graph.edges[to].add(fr);
  }
}

export function remove_edge(graph, fr, to) {
  // Removes an edge between the given node IDs.
  fr = +fr;
  to = +to;
  if (fr < to) {
    if (!graph.edges.hasOwnProperty(fr)) {
      console.warn("Attempt to remove nonexistent edge:", graph, fr, to);
      return; // edge didn't exist in the first place
    }
    graph.edges[fr].delete(to);
    if (graph.edges[fr].size == 0) { delete graph.edges[fr]; }
  } else {
    if (!graph.edges.hasOwnProperty(to)) {
      console.warn("Attempt to remove nonexistent edge:", graph, fr, to);
    }
    graph.edges[to].delete(fr);
    if (graph.edges[to].size == 0) { delete graph.edges[to]; }
  }
}

export function add_node(graph, node) {
  // Adds a node to the graph. The node must already have an assigned ID.
  graph.nodes[node.id] = node;
}

export function remove_node(graph, id) {
  // Removes a node from a graph (using it's id). Does not clean up links that
  // may still refer to the node (see remove_all_edges_touching).
  delete graph.nodes[id];
}

export function remove_all_edges_touching(graph, id) {
  // Removes all edges that connect to the node with the given ID from the
  // graph.

  // Iterate to remove incoming edges;
  for (let fr of Object.keys(graph.edges)) {
    if (+fr < +id) { // nodes where the link is recorded in their edge sets
      graph.edges[fr].delete(id);
    } // other nodes will just be in the edge set of the target
  }
  // Remove all outgoing edges:
  delete graph.edges[id];
}

export function lookup_pos(graph, pos) {
  // Returns the node ID in the given graph that contains the given position,
  // or undefined for a pruned BSP where the given position isn't covered by
  // any node.
  for (let id of Object.keys(graph.nodes)) {
    let node = graph.nodes[id];
    if (
      node.left <= pos[0]
   && node.right >= pos[0]
   && node.top <= pos[1]
   && node.bottom >= pos[1]
    ) {
      return id;
    }
  }
  // Didn't find any matching node:
  return undefined;
}

export function preserve_set(graph, positions) {
  // Converts a list of positions into a preserve set (of node IDs) for the
  // given graph.
  let result = [];
  for (let pos of positions) {
    let id = lookup_pos(graph, pos);
    if (id != undefined) {
      result.add(+id);
    }
  }
  return result;
}

export function prune_bsp(graph, prune_fraction, preserve) {
  // Prunes nodes from a random BSP graph to create a sparser graph that
  // doesn't cover the entire pane. Does so in a way that preserves full
  // connectivity of all nodes in the graph. If preserve is given, it should be
  // a Set of node IDs, and will ensure that those node(s) will not be pruned.
  // The prune_fraction argument (also optional) controls what fraction of
  // nodes to prune (stochastically).
  if (prune_fraction == undefined) { prune_fraction = DEFAULT_PRUNE_FRACTION; }
  if (preserve == undefined) { preserve = new Set(); }

  // TODO: this function!
}

export function node_center(node) {
  // Returns the center position of the given node, rounded up and to the left.
  return [
    node.left + Math.floor((node.right - node.left)/2),
    node.top + Math.floor((node.bottom - node.top)/2)
  ];
}

export function node_rep(graph, node, seed_adj) {
  // Returns a random representative position for a node in the given graph.
  // seed_adj may be supplied to get a different result.
  if (seed_adj == undefined) { seed_adj = 7593298; }
  let seed = rng.next(graph.seed + seed_adj);
  seed = rng.next(seed + node.left * (node.right + 3));
  seed = rng.next(seed + node.top * (node.bottom + 3));
  let x, y;
  if (node.right > node.left) {
    x = rng.select(node.left, node.right, seed);
  } else {
    x = node.left;
  }
  seed = rng.next(seed + (+node.id));
  if (node.bottom > node.top) {
    y = rng.select(node.top, node.bottom, seed);
  } else {
    y = node.top;
  }
  return [x, y];
}

export function node_centerish(graph, node) {
  // Returns a random representative position for the given node that tends
  // towards the center. Just calls node_rep three times and averages the
  // results, but also prevents centers from being placed along the edge of the
  // pane when it can.
  let rep = [0, 0];
  for (let i = 0; i < 3; ++i) {
    let rand = node_rep(graph, node, i*47298);
    rep[0] += rand[0];
    rep[1] += rand[1];
  }
  rep[0] = Math.floor(rep[0] / 3);
  rep[1] = Math.floor(rep[1] / 3);

  // Push away from walls:
  if (rep[0] == 0 && node.right > 0) { rep[0] += 1; }
  if (rep[0] == world.PANE_SIZE - 1 && node.left < rep[0]) { rep[0] -= 1; }
  if (rep[1] == 0 && node.bottom > 0) { rep[1] += 1; }
  if (rep[1] == world.PANE_SIZE - 1 && node.top < rep[1]) { rep[1] -= 1; }

  return rep;
}
