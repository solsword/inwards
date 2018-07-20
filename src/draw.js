// draw.js
// Drawing code for Inwards; Onwards.

import * as world from "./world";
import * as blocks from "./blocks";
import * as physics from "./physics";

export var FONT_SIZE = 24;
export var FONT_FACE = "asap";
//export var FONT_FACE = "serif";

export var MENU_PALETTE = {
  "background": "#447",
  "text": "#bbf",
  "border": "bbf",
  "button": "bbf",
  "button_border": "#88c",
  "button_text": "#447",
  "button_text_outline": "#88c",
  "selected_button": "#88c",
};

export function interp_color(original, proportion, target) {
  // Interpolates two colors according to the given proportion. Accepts and
  // returns RGB hex strings.
  var c1 = color_from_hex(original);
  var c2 = color_from_hex(target);
  var r = [
    c1[0] * (1 - proportion) + c2[0] * proportion,
    c1[1] * (1 - proportion) + c2[1] * proportion,
    c1[2] * (1 - proportion) + c2[2] * proportion
  ];
  return hex_from_color(r);
}

export function color_from_hex(h) {
  if (h[0] == "#") {
    h = h.slice(1);
  }
  if (h.length == 3) {
    var r = h.substr(0, 1);
    var g = h.substr(1, 1);
    var b = h.substr(2, 1);
    h = r+r+g+g+b+b;
  }
  return [
    parseInt(h.substr(0, 2), 16),
    parseInt(h.substr(2, 2), 16),
    parseInt(h.substr(4, 2), 16)
  ];
}

export function hex_from_color(c) {
  var r = ("0" + Math.floor(c[0]).toString(16)).slice(-2);
  var g = ("0" + Math.floor(c[1]).toString(16)).slice(-2);
  var b = ("0" + Math.floor(c[2]).toString(16)).slice(-2);
  return "#" + r + g + b;
}

export function world_pos(ctx, vpos) {
  var result = [vpos[0], vpos[1]];
  result[0] -= ctx.middle[0];
  result[1] -= ctx.middle[1];
  result[1] = -result[1];
  result[0] /= ctx.viewport_scale;
  result[1] /= ctx.viewport_scale;
  result[0] += ctx.viewport_center[0];
  result[1] += ctx.viewport_center[1];
  return result;
}

export function view_pos(ctx, wpos) {
  var result = [wpos[0], wpos[1]];
  result[0] -= ctx.viewport_center[0];
  result[1] -= ctx.viewport_center[1];
  result[1] = -result[1];
  result[0] *= ctx.viewport_scale;
  result[1] *= ctx.viewport_scale;
  result[0] += ctx.middle[0];
  result[1] += ctx.middle[1];
  return result;
}

export function viewport_edges(ctx) {
  // Returns viewport edges (left/top/right/bottom) in world coordinates.
  var tl = world_pos(ctx, [0, 0]);
  var br = world_pos(ctx, [ctx.cwidth, ctx.cheight]);
  return [tl[0], tl[1], br[0], br[1]];
}

export function draw_world(ctx, wld, trace) {
  // Draws the world visible within the context's viewport using the given
  // trace to anchor location.
  // TODO: Chunk rendering...
  let edges = viewport_edges(ctx);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = Math.floor(FONT_SIZE * ctx.viewport_scale) + "px " + FONT_FACE;

  let target_loc = undefined;
  let target_pid = undefined;
  let depth_adjust = 0;
  for (let i = trace.length - 1; i >= 0; --i) {
    if (trace[i] == undefined) {
      // TODO: Hallucinate parents here?
      break;
    }
    if (target_pid != undefined) {
      depth_adjust += 1;
      let lpos = target_loc[0];
      let sf = world.get_scale_factor(wld, trace[i][1], lpos);
      let new_edges = [
        world.outer_coord(edges[0], lpos[0], sf),
        world.outer_coord(edges[1], lpos[1], sf),
        world.outer_coord(edges[2], lpos[0], sf),
        world.outer_coord(edges[3], lpos[1], sf)
      ];
      edges = new_edges;
    }
    target_loc = trace[i];
    target_pid = target_loc[1];
  }

  // Call recursive drawing function.
  draw_panes(ctx, wld, target_pid, edges, -depth_adjust);
}

export function draw_panes(ctx, wld, target_pid, edges, depth) {
  // Takes a drawing context, a world, a target pane id, and a
  // left/top/right/bottom edges list, and draws that portion of that pane.
  // Recursively expands edges so that inner panes are correctly drawn at a
  // smaller scale. Tracks depth and cuts off after depth 2; never renders
  // blocks/panes that fall outside the given edges.
  if (depth > 2) {
    return;
  }

  let ew = edges[2] - edges[0];
  let eh = edges[3] - edges[1];
  let hscale = ctx.cwidth / ew;
  let vscale = ctx.cheight / eh;

  function x_(x) { return (x - edges[0]) * hscale; }
  function y_(y) { return (y - edges[1]) * vscale; }

  let pane = wld.panes[target_pid];

  // Draw blocks:
  for (let x = 0; x < world.PANE_SIZE; ++x) {
    for (let y = 0; y < world.PANE_SIZE; ++y) {
      let block = world.block_at(pane, [x, y]);
      ctx.fillStyle = blocks.color(block);
      ctx.strokeStyle = blocks.accent_color(block);
      // TODO: Stroke width?
      ctx.beginPath();
      ctx.moveTo(x_(x), y_(y));
      ctx.lineTo(x_(x+1), y_(y));
      ctx.lineTo(x_(x+1), y_(y+1));
      ctx.lineTo(x_(x), y_(y+1));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  // Recursively draw inlays:
  for (let ins of pane.inlays) {
    let sf = ins.size / world.PANE_SIZE;
    let inner_edges = [
      world.inner_coord(edges[0], ins.at[0], sf),
      world.inner_coord(edges[1], ins.at[1], sf),
      world.inner_coord(edges[2], ins.at[0], sf),
      world.inner_coord(edges[3], ins.at[1], sf),
    ];
    draw_panes(wld, ins.id, inner_edges, depth + 1);
  }
}

// Draws an edge of the given shape with the given center point, radius, and
// corner radius.
export function draw_edge(ctx, e_shape, side, cx, cy, r, cr) {
  ctx.save()
  ctx.translate(cx, cy);
  ctx.rotate((Math.PI / 2) * side);
  var fx = -r + cr;
  var fy = -r;
  var tx = r - cr;
  var ty = -r;
  cx = 0;
  cy = 0;
  e_shape = ((e_shape % 17) + 17) % 17;
  // Draw the edge
  switch (e_shape) {
    default:
    case 0: // straight line
      ctx.lineTo(tx, ty);
      break;

    case 1: // two-segment outer line
      var mx = fx + (tx - fx) / 2;
      var my = fy + (ty - fy) / 2;

      var px = mx - (cx - mx) * 0.2;
      var py = my - (cy - my) * 0.2;

      ctx.lineTo(px, py);
      ctx.lineTo(tx, ty);
      break;

    case 2: // two-segment inner line
      var mx = fx + (tx - fx) / 2;
      var my = fy + (ty - fy) / 2;

      var px = mx + (cx - mx) * 0.2;
      var py = my + (cy - my) * 0.2;

      ctx.lineTo(px, py);
      ctx.lineTo(tx, ty);
      break;

    case 3: // four-segment outer zig-zag
      var mx = fx + (tx - fx) / 2;
      var my = fy + (ty - fy) / 2;

      var m1x = fx + (mx - fx) / 2;
      var m1y = fy + (my - fy) / 2;

      var p1x = m1x - (cx - mx) * 0.1;
      var p1y = m1y - (cy - my) * 0.1;

      var p2x = mx + (cx - mx) * 0.1;
      var p2y = my + (cy - my) * 0.1;

      var m2x = mx + (tx - mx) / 2;
      var m2y = my + (ty - my) / 2;

      var p3x = m2x - (cx - mx) * 0.1;
      var p3y = m2y - (cy - my) * 0.1;

      ctx.lineTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.lineTo(p3x, p3y);
      ctx.lineTo(tx, ty);
      break;

    case 4: // four-segment inner zig-zag
      var mx = fx + (tx - fx) / 2;
      var my = fy + (ty - fy) / 2;

      var m1x = fx + (mx - fx) / 2;
      var m1y = fy + (my - fy) / 2;

      var p1x = m1x + (cx - mx) * 0.1;
      var p1y = m1y + (cy - my) * 0.1;

      var p2x = mx - (cx - mx) * 0.1;
      var p2y = my - (cy - my) * 0.1;

      var m2x = mx + (tx - mx) / 2;
      var m2y = my + (ty - my) / 2;

      var p3x = m2x + (cx - mx) * 0.1;
      var p3y = m2y + (cy - my) * 0.1;

      ctx.lineTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.lineTo(p3x, p3y);
      ctx.lineTo(tx, ty);
      break;

    case 5: // curved line
      var angle = (Math.PI / 2) - Math.atan2(r + cr, r - cr);
      var radius = Math.sqrt(Math.pow(r + cr, 2) + Math.pow(r - cr, 2));

      ctx.arc(
        0,
        cr,
        radius,
        (3 * Math.PI / 2) - angle,
        (3 * Math.PI / 2) + angle
      );
      break;

    case 6: // circular-indented line
      var mx = (fx + tx) / 2;
      var my = (fy + ty) / 2;
      var dist = Math.sqrt(Math.pow(tx - fx, 2) + Math.pow(ty - fy, 2));
      var ir = 0.14 * dist;
      ctx.lineTo(fx + (tx - fx) * 0.43, fy + (ty - fy) * 0.43);
      ctx.arc(mx, my, ir, Math.PI, 0, true); // ccw
      ctx.lineTo(tx, ty);
      break;

    case 7: // circular-outdented line
      var mx = (fx + tx) / 2;
      var my = (fy + ty) / 2;
      var dist = Math.sqrt(Math.pow(tx - fx, 2) + Math.pow(ty - fy, 2));
      var ir = 0.2 * dist;
      ctx.lineTo(fx + (tx - fx) * 0.4, fy + (ty - fy) * 0.4);
      ctx.arc(mx, my, ir, Math.PI, 2 * Math.PI); // ccw
      ctx.lineTo(tx, ty);
      break;

    case 8: // line with triangle indent
      var mx = (fx + tx) / 2;
      var my = (fy + ty) / 2;
      var px = mx + (cx - mx) * 0.15;
      var py = my + (cy - my) * 0.15;
      var dist = Math.sqrt(Math.pow(tx - fx, 2) + Math.pow(ty - fy, 2));
      ctx.lineTo(fx + (tx - fx) * 0.3, fy + (ty - fy) * 0.3);
      ctx.lineTo(px, py);
      ctx.lineTo(fx + (tx - fx) * 0.7, fy + (ty - fy) * 0.7);
      ctx.lineTo(tx, ty);
      break;

    case 9: // line with triangle outdent
      var mx = (fx + tx) / 2;
      var my = (fy + ty) / 2;
      var px = mx - (cx - mx) * 0.15;
      var py = my - (cy - my) * 0.15;
      var dist = Math.sqrt(Math.pow(tx - fx, 2) + Math.pow(ty - fy, 2));
      ctx.lineTo(fx + (tx - fx) * 0.3, fy + (ty - fy) * 0.3);
      ctx.lineTo(px, py);
      ctx.lineTo(fx + (tx - fx) * 0.7, fy + (ty - fy) * 0.7);
      ctx.lineTo(tx, ty);
      break;

    case 10: // line with square indent
       // midpoint
      var mx = (fx + tx) / 2;
      var my = (fy + ty) / 2;
      // indent start
      var isx = fx + (tx - fx) * 0.3;
      var isy = fy + (ty - fy) * 0.3;
      // indent end
      var iex = fx + (tx - fx) * 0.7;
      var iey = fy + (ty - fy) * 0.7;

      // points 1 and 2 of indent
      var px1 = isx + (cx - mx) * 0.2;
      var py1 = isy + (cy - my) * 0.2;
      var px2 = iex + (cx - mx) * 0.2;
      var py2 = iey + (cy - my) * 0.2;
      ctx.lineTo(isx, isy);
      ctx.lineTo(px1, py1);
      ctx.lineTo(px2, py2);
      ctx.lineTo(iex, iey);
      ctx.lineTo(tx, ty);
      break;

    case 11: // line with square outdent
       // midpoint
      var mx = (fx + tx) / 2;
      var my = (fy + ty) / 2;
      // indent start
      var isx = fx + (tx - fx) * 0.3;
      var isy = fy + (ty - fy) * 0.3;
      // indent end
      var iex = fx + (tx - fx) * 0.7;
      var iey = fy + (ty - fy) * 0.7;

      // points 1 and 2 of indent
      var px1 = isx - (cx - mx) * 0.2;
      var py1 = isy - (cy - my) * 0.2;
      var px2 = iex - (cx - mx) * 0.2;
      var py2 = iey - (cy - my) * 0.2;
      ctx.lineTo(isx, isy);
      ctx.lineTo(px1, py1);
      ctx.lineTo(px2, py2);
      ctx.lineTo(iex, iey);
      ctx.lineTo(tx, ty);
      break;

    case 12: // two bumps
      var idist = r * 0.15;

      var p1x = fx / 2;
      var p1y = -r + idist;

      var p2x = tx / 2;
      var p2y = -r + idist;

      var angle = Math.atan2(idist, fx - p1x) - (Math.PI / 2);

      var radius = Math.sqrt(Math.pow(fx - p1x, 2) + Math.pow(fy - p1y, 2));

      ctx.arc(
        p1x,
        p1y,
        radius,
        (3 * Math.PI / 2) - angle,
        (3 * Math.PI / 2) + angle
      );
      ctx.arc(
        p2x,
        p2y,
        radius,
        (3 * Math.PI / 2) - angle,
        (3 * Math.PI / 2) + angle
      );
      break;

    case 13: // two round indents
      var idist = r * 0.15;

      var p1x = fx / 2;
      var p1y = -r - idist;

      var p2x = tx / 2;
      var p2y = -r - idist;

      var angle = Math.atan2(idist, fx - p1x) - (Math.PI / 2);

      var radius = Math.sqrt(Math.pow(fx - p1x, 2) + Math.pow(fy - p1y, 2));

      ctx.arc(
        p1x,
        p1y,
        radius,
        (Math.PI / 2) + angle,
        (Math.PI / 2) - angle,
        true
      );
      ctx.arc(
        p2x,
        p2y,
        radius,
        (Math.PI / 2) + angle,
        (Math.PI / 2) - angle,
        true
      );
      break;

    case 14: // three-curve wave
      var idist = r * 0.15;

      var sixth = (tx - fx) / 6;

      var p1x = fx + sixth;
      var p1y = -r + idist;

      var p2x = 0;
      var p2y = -r - idist;

      var p3x = tx - sixth;
      var p3y = -r + idist;

      var angle = (Math.PI / 2) - Math.atan2(idist, sixth);

      var radius = Math.sqrt(Math.pow(sixth, 2) + Math.pow(idist, 2));

      ctx.arc(
        p1x,
        p1y,
        radius,
        (3 * Math.PI / 2) - angle,
        (3 * Math.PI / 2) + angle
      );
      ctx.arc(
        p2x,
        p2y,
        radius,
        (Math.PI / 2) + angle,
        (Math.PI / 2) - angle,
        true
      );
      ctx.arc(
        p3x,
        p3y,
        radius,
        (3 * Math.PI / 2) - angle,
        (3 * Math.PI / 2) + angle
      );
      break;

    case 15: // inverted wave
      var idist = r * 0.15;

      var sixth = (tx - fx) / 6;

      var p1x = fx + sixth;
      var p1y = -r - idist;

      var p2x = 0;
      var p2y = -r + idist;

      var p3x = tx - sixth;
      var p3y = -r - idist;

      var angle = (Math.PI / 2) - Math.atan2(idist, sixth);

      var radius = Math.sqrt(Math.pow(sixth, 2) + Math.pow(idist, 2));

      ctx.arc(
        p1x,
        p1y,
        radius,
        (Math.PI / 2) + angle,
        (Math.PI / 2) - angle,
        true
      );
      ctx.arc(
        p2x,
        p2y,
        radius,
        (3 * Math.PI / 2) - angle,
        (3 * Math.PI / 2) + angle
      );
      ctx.arc(
        p3x,
        p3y,
        radius,
        (Math.PI / 2) + angle,
        (Math.PI / 2) - angle,
        true
      );
      break;

    case 16: // inner trapezoid
      var rad = cr/3;
      ctx.lineTo(fx + rad, -r + rad);
      ctx.lineTo(tx - rad, -r + rad);
      ctx.lineTo(tx, ty);
      break;
  }
  ctx.restore()
}

// Draws a corner of the given shape at the given points with the given
// orientation, corner point, radius, and corner radius.
export function draw_corner(ctx, shape, ori, x, y, r, cr) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((Math.PI / 2) * ori);
  shape = ((shape % 6) + 6) % 6;
  // Draw the corner
  switch (shape) {
    default:
    case 0: // square corner
      ctx.lineTo(0, 0);
      ctx.lineTo(0, cr);
      break;
    case 1: // arc corner (chopped is too similar)
      var a1 = Math.atan2(r - cr, r) + 3 * Math.PI / 2;
      var a2 = Math.atan2(r, r - cr) + 3 * Math.PI / 2;
      var arc_r = Math.sqrt(Math.pow(r, 2) + Math.pow(r - cr, 2));
      ctx.arc(-r, r, arc_r, a1, a2);
      break;
    case 2: // rounded corner
      ctx.arc(-cr, cr, cr, 3 * Math.PI / 2, 2 * Math.PI);
      break;
    case 3: // rounded inner corner
      ctx.arc(0, 0, cr, Math.PI, Math.PI / 2, true);
      break;
    case 4: // triangular inner corner
      ctx.lineTo(-cr * 0.8, cr * 0.8);
      ctx.lineTo(0, cr);
      break;
    case 5: // trapezoid outer corner
      ctx.lineTo(-cr/2, -cr/6);
      ctx.lineTo(cr/6, cr/2);
      ctx.lineTo(0, cr);
      break;
  }
  ctx.restore();
}

// Takes a context, an array of four shape integers, a center position, and a
// radius and draws a pad shape to put a glyph on. Stroking and/or filling
// this shape is up to the caller.
export function draw_pad_shape(ctx, shape, cx, cy, r) {
  ctx.beginPath();
  var olj = ctx.lineJoin;
  // ctx.lineJoin = "round";
  // ctx.lineJoin = "mitre";
  var cr = r * 0.4;
  var lt = cx - r;
  var rt = cx + r;
  var tp = cy - r;
  var bt = cy + r;
  ctx.moveTo(lt + cr, tp);
  draw_edge(ctx, shape[0], 0, cx, cy, r, cr);
  draw_corner(ctx, shape[3], 0, rt, tp, r, cr);
  draw_edge(ctx, shape[2], 1, cx, cy, r, cr);
  draw_corner(ctx, shape[3], 1, rt, bt, r, cr);
  draw_edge(ctx, shape[1], 2, cx, cy, r, cr);
  draw_corner(ctx, shape[3], 2, lt, bt, r, cr);
  draw_edge(ctx, shape[2], 3, cx, cy, r, cr);
  draw_corner(ctx, shape[3], 3, lt, tp, r, cr);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineJoin = olj;
}

// TODO: Get rid of this if we're not using it?
export function draw_loading(ctx, keys, loading) {
  var n_bars = keys.length;
  var bars_top = (
    ctx.cheight/2
  - (n_bars * (LOADING_BAR_HEIGHT + LOADING_BAR_SPACING))
  + LOADING_BAR_SPACING
  );
  keys.forEach(function (key, ii) {
    // Unpack progress:
    var progress = loading[key];
    var fetched = progress[0];
    var count_progress = progress[1];
    var index_progress = progress[2];

    // Decide position:
    var x = 10;
    var y = bars_top + ii * (LOADING_BAR_HEIGHT + LOADING_BAR_SPACING);

    ctx.fillStyle = LOADING_COLORS["inner"];
    ctx.fillRect(x, y, LOADING_BAR_WIDTH, LOADING_BAR_HEIGHT);
    if (fetched) {
      ctx.strokeStyle = LOADING_COLORS["outline"];
    } else {
      ctx.strokeStyle = LOADING_COLORS["deactive"];
    }
    ctx.strokeRect(x, y, LOADING_BAR_WIDTH, LOADING_BAR_HEIGHT);
    ctx.fillStyle = LOADING_COLORS["index"];
    ctx.fillRect(
      x + 2,
      y + 2,
      (LOADING_BAR_WIDTH - 4) * index_progress,
      (LOADING_BAR_HEIGHT - 5) / 2
    );
    ctx.fillStyle = LOADING_COLORS["counts"];
    ctx.fillRect(
      x + 2,
      y + 2 + (LOADING_BAR_HEIGHT - 5) / 2 + 1,
      (LOADING_BAR_WIDTH - 4) * count_progress,
      (LOADING_BAR_HEIGHT - 5) / 2
    );
    txt = key
    var m = ctx.measureText(txt);
    while (m.width >= LOADING_BAR_WIDTH - 4) {
      txt = txt.slice(0, txt.length-2) + "…";
      m = ctx.measureText(txt);
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = (
      ((LOADING_BAR_HEIGHT - 4) * ctx.viewport_scale) + "px "
    + "asap"
    );
    ctx.fillStyle = LOADING_COLORS["text"];
    ctx.fillText(txt, x+2, y+2);
  });
}
