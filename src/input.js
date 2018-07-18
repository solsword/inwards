// Handlers
var MOUSE_HANDLERS = {};
var MOTION_HANDLERS = {};
var KEY_COMMANDS = {};

// Mouse button state
var MOUSE_BUTTON_STATE = {};

export function canvas_position_of_event(e, ctx) {
  if (e.touches) {
    e = e.touches[0];
  }
  var client_x = e.clientX - ctx.bounds.left;
  var client_y = e.clientY - ctx.bounds.top;
  return [
    client_x * ctx.cwidth / ctx.bounds.width,
    client_y * ctx.cheight / ctx.bounds.height
  ];
}


export function which_click(e) {
  if (e.touches) {
    if (e.touches.length > 1) {
      return "auxiliary";
    } else {
      return "primary";
    }
  } else {
    if (e.button == 0) {
      return "primary";
    } else if (e.button == 1) {
      return "auxiliary";
    } else if (e.button == 2) {
      return "secondary";
    } else {
      return "tertiary";
    }
  }
}

export function register_mouse_handler(click_type, button_type, handler) {
  if (!MOUSE_HANDLERS.hasOwnProperty(click_type)) {
    MOUSE_HANDLERS[click_type] = {};
  }
  if (!MOUSE_HANDLERS[click_type].hasOwnProperty(button_type)) {
    MOUSE_HANDLERS[click_type][button_type] = [];
  }
  let hlist = MOUSE_HANDLERS[click_type][button_type];
  let idx = hlist.indexOf(handler);
  if (idx >= 0) {
    return; // already registered
  } else {
    hlist.push(handler);
  }
}

export function unregister_mouse_handler(click_type, button_type, handler) {
  if (!MOUSE_HANDLERS.hasOwnProperty(click_type)) {
    return;
  }
  if (!MOUSE_HANDLERS[click_type].hasOwnProperty(button_type)) {
    return;
  }
  var hlist = MOUSE_HANDLERS[click_type][button_type];
  let idx = hlist.indexOf(handler);
  if (idx >= 0) {
    hlist.splice(idx, 1);
  }
}

function handle_mouse(ctx, type, button, e) {
  // Call our handlers (generic & then specific) one by one, until one of them
  // claims to have handled the event. Each handler receives a context, the
  // viewport position of the event, the button, and the event object itself as
  // arguments.
  if (type == "down") {
    MOUSE_BUTTON_STATE[button] = true;
  } else if (type == "up") {
    MOUSE_BUTTON_STATE[button] = false;
  }
  var vpos = canvas_position_of_event(e);
  var thandlers = MOUSE_HANDLERS[type];
  if (thandlers == undefined) {
    return;
  }
  var generic = MOUSE_HANDLERS[type]["any"];
  var specific = MOUSE_HANDLERS[type][button];
  var handled = false;
  if (generic != undefined) {
    for (let h of generic) {
      if (h(ctx, vpos, button, e)) {
        handled = true;
        break;
      }
    }
  }
  if (!handled && specific != undefined) {
    for (let h of specific) {
      if (h(ctx, vpos, button, e)) {
        handled = true;
        break;
      }
    }
  }
}

export function register_motion_handler(button_type, handler) {
  if (!MOTION_HANDLERS.hasOwnProperty(button_type)) {
    MOTION_HANDLERS[button_type] = [];
  }
  let hlist = MOTION_HANDLERS[button_type];
  let idx = hlist.indexOf(handler);
  if (idx >= 0) {
    return; // already registered
  } else {
    hlist.push(handler);
  }
}

export function unregister_motion_handler(button_type, handler) {
  if (!MOTION_HANDLERS.hasOwnProperty(button_type)) {
    return;
  }
  let hlist = MOTION_HANDLERS[button_type];
  let idx = hlist.indexOf(handler);
  if (idx >= 0) {
    hlist.splice(idx, 1); // remove it
  }
}

function handle_movement(ctx, e) {
  // Motion handler gets the context, viewport position, mouse buttons state,
  // and event as arguments.
  var vpos = canvas_position_of_event(e);
  var handlers = MOTION_HANDLERS["any"] || [];
  for (let button of MOUSE_BUTTON_STATE) {
    if (MOUSE_BUTTON_STATE[button]) {
      handlers = Array.concat(handlers, MOTION_HANDLERS[button]);
    }
  }
  for (let h of handlers) {
    if (h(ctx, vpos, MOUSE_BUTTON_STATE, e)) {
      handled = true;
      break;
    }
  }
}

export function register_key_command(key, command) {
  // Unregister by calling this with 'undefined'
  KEY_COMMANDS[key] = command;
}

function handle_key(ctx, key, e) {
  // Key command gets context, key, and event as arguments.
  var cmd = KEY_COMMANDS[key];
  if (cmd) {
    cmd(ctx, key, e);
  }
}

export function bind_events(document, ctx) {
  document.onmousedown = function (e) {
    if (e.preventDefault) { e.preventDefault(); }
    var which = which_click(e);
    handle_mouse(ctx, "down", which, e);
  }
  document.ontouchstart = document.onmousedown;

  document.onmouseup = function (e) {
    if (e.preventDefault) { e.preventDefault(); }
    var which = which_click(e);
    handle_mouse(ctx, "up", which, e);
  }
  document.ontouchend = document.onmouseup;

  document.onmousemove = function (e) {
    if (e.preventDefault) { e.preventDefault(); }
    handle_movement(ctx, e);
  }
  document.ontouchmove = document.onmousemove;

  document.onkeydown = function (e) {
    handle_key(ctx, e.key, e);
  }
}
