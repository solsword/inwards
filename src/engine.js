import * as input from "./input";
import * as menu from "./menu";
import * as draw from "./draw";
import * as world from "./world";
import * as physics from "./physics";
import * as animate from "./animate";

// Viewport & window stuff:
var RESIZE_TIMEOUT = 20;

// Canvas context:
var CANVAS;
var CTX;

// Animation:
var ANIMATION_FRAME = 0;

// Menus:
var MENU_BUTTON = null;
var PAUSE_MENU = null;

// Game context:
var THE_PLAYER = null;
var CURRENT_WORLD = null;

export function update_canvas_size() {
  // Updates the canvas size. Called on resize after a timeout.
  var bounds = CANVAS.getBoundingClientRect();
  var car = bounds.width / bounds.height;
  CANVAS.width = 800 * car;
  CANVAS.height = 800;
  CTX.cwidth = CANVAS.width;
  CTX.cheight = CANVAS.height;
  CTX.middle = [CTX.cwidth / 2, CTX.cheight / 2];
  CTX.bounds = bounds;
  menu.set_canvas_size([CANVAS.width, CANVAS.height]);
}

function draw_frame(now) {
  ANIMATION_FRAME += 1; // count frames
  ANIMATION_FRAME %= animate.ANIMATION_FRAME_MAX;

  // Figure out viewport parameters
  // TODO: Incorporate player scale!
  CTX.viewport_center = THE_PLAYER.pos.slice();
  CTX.viewport_scale = Math.min(CTX.cwidth, CTX.cheight) / world.PANE_SIZE;

  // Physics updates:
  physics.tick_world(CURRENT_WORLD, THE_PLAYER.trace);

  // Clear the canvas:
  CTX.clearRect(0, 0, CTX.cwidth, CTX.cheight);

  // Draw the world:
  draw.draw_world(CTX, CURRENT_WORLD, THE_PLAYER.trace)

  // Draw animations:
  animate.draw_active(CTX, ANIMATION_FRAME);

  // Draw menus:
  menu.draw_active(CTX);

  // reschedule ourselves
  // TODO: Normalize frame count to passage of time?
  window.requestAnimationFrame(draw_frame);
}


export function go() {
  // Starts up everything, kicking off draw_frame and setting stuff up.
  CANVAS = document.getElementById("canvas");
  CTX = CANVAS.getContext("2d");
  update_canvas_size();

  // TODO: Non-test here
  CURRENT_WORLD = world.init_world("test");
  let test_pane = world.create_pane(CURRENT_WORLD);
  world.fill_test_pane(CURRENT_WORLD, test_pane.id);
  THE_PLAYER = world.create_entity(CURRENT_WORLD);
  world.set_home(test_pane, [6, 12], THE_PLAYER);
  world.warp_home(THE_PLAYER);

  var screensize = Math.min(window.innerWidth, window.innerHeight);
  if (screensize < 500) {
    // Smaller devices
    CTX.ui_scale = 2.0;
  } else {
    CTX.ui_scale = 1.0;
  }

  // kick off animation
  window.requestAnimationFrame(draw_frame);

  // Listen for window resizes but wait until RESIZE_TIMEOUT after the last
  // consecutive one to do anything.
  var timer_id = undefined;
  window.addEventListener("resize", function() {
    if (timer_id != undefined) {
      clearTimeout(timer_id);
      timer_id = undefined;
    }
    timer_id = setTimeout(
      function () {
        timer_id = undefined;
        update_canvas_size();
      },
      RESIZE_TIMEOUT
    );
  });

  // set up menus;
  PAUSE_MENU = new menu.Dialog(
    CTX,
    undefined,
    undefined,
    {},
    "TODO: Implement this menu!",
    [ { "text": "RESUME", "action": function () { MENU_BUTTON.off_(); } } ]
  );

  MENU_BUTTON = new menu.ToggleMenu(
    CTX,
    { "right": 10, "bottom": 10 },
    { "width": 40, "height": 40 },
    {},
    "■", // TODO: What should the symbol be?
    function () { menu.add_menu(PAUSE_MENU); }, // TODO: Also pause the game!
    function () { menu.remove_menu(PAUSE_MENU); },
  );
  menu.add_menu(MENU_BUTTON);

  input.bind_events(document, CTX);
  // set up menu dispatch
  input.register_mouse_handler(
    "down",
    "any",
    function (ctx, vpos, button, e) {
      return menu.mousedown(vpos, button);
    }
  );
  input.register_mouse_handler(
    "up",
    "any",
    function (ctx, vpos, button, e) {
      return menu.mouseup(vpos, button);
    }
  );
  input.register_motion_handler(
    "any",
    function (ctx, vpos, buttons, e) {
      return menu.mousemove(vpos);
    }
  )
}