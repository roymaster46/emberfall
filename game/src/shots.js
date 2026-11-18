// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by a simple autopilot (kite away
// from the nearest enemy and bullet, chase the nearest spark, shoot the nearest foe), so the
// frame is what a short game really looks like and the same seed always gives the same frame.
import { FIELD, STEP } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 16;
const END_LIMIT_SECONDS = 600;
const SAMPLE = STEP;

/** A scripted stand-in for the live input: the autopilot sets move, aim and fire each step. */
function scriptedInput() {
  const state = {
    mx: 0,
    my: 0,
    ax: 0,
    ay: 0,
    fire: false,
    dash: false,
    mouseX: FIELD.width / 2,
    mouseY: FIELD.height / 2 - 120,
  };
  return {
    state,
    axis() {
      return { x: state.ax, y: state.ay };
    },
    firing() {
      return state.fire;
    },
    dashPressed() {
      return state.dash;
    },
    mouse() {
      return { x: state.mouseX, y: state.mouseY, down: state.fire, clicked: false };
    },
  };
}

/**
 * Steer the wisp: flee the closest threat, drift toward the closest spark, keep inside the
 * arena, and shoot the nearest enemy. `skill` 1 plays to survive; 0.35 plays carelessly, so
 * the end scene is caught out once the waves speed up.
 */
function autopilot(world, input, skill) {
  const player = world.player;
  const s = input.state;
  let mx = 0;
  let my = 0;
  let nearest = null;
  let nearestD = Infinity;
  for (const e of world.enemies) {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = e;
    }
  }
  if (nearest && nearestD < 260 * skill + 60) {
    const w = (260 - Math.min(260, nearestD)) / 260;
    mx += ((player.x - nearest.x) / (nearestD || 1)) * w * 2;
    my += ((player.y - nearest.y) / (nearestD || 1)) * w * 2;
  }
  for (const b of world.bullets) {
    if (b.friendly) continue;
    const d = Math.hypot(b.x - player.x, b.y - player.y);
    if (d < 110) {
      // Sidestep: run perpendicular to the bullet's path.
      const px = -b.vy;
      const py = b.vx;
      const len = Math.hypot(px, py) || 1;
      const side = (player.x - b.x) * px + (player.y - b.y) * py >= 0 ? 1 : -1;
      mx += (px / len) * side * 1.2;
      my += (py / len) * side * 1.2;
    }
  }
  let spark = null;
  let sparkD = Infinity;
  for (const p of world.pickups) {
    if (p.kind !== 'spark') continue;
    const d = Math.hypot(p.x - player.x, p.y - player.y);
    if (d < sparkD) {
      sparkD = d;
      spark = p;
    }
  }
  if (spark && sparkD > 24) {
    mx += ((spark.x - player.x) / sparkD) * 0.8;
    my += ((spark.y - player.y) / sparkD) * 0.8;
  }
  // Keep off the walls.
  if (player.x < 80) mx += 1;
  if (player.x > FIELD.width - 80) mx -= 1;
  if (player.y < 80) my += 1;
  if (player.y > FIELD.height - 80) my -= 1;
  const len = Math.hypot(mx, my);
  if (len > 0.01) {
    s.ax = mx / len;
    s.ay = my / len;
  } else {
    s.ax = 0;
    s.ay = 0;
  }
  if (nearest) {
    s.mouseX = nearest.x;
    s.mouseY = nearest.y;
    s.fire = skill > 0.5 || nearestD < 320;
  } else {
    s.fire = false;
  }
  s.dash = nearest !== null && nearestD < 90 && player.dashCooldown <= 0;
}

function simulate(seconds, skill, seed) {
  const world = createWorld(seed);
  world.best = 1250;
  const input = scriptedInput();
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    if (world.over) break;
    autopilot(world, input, skill);
    stepWorld(world, input, SAMPLE);
  }
  return world;
}

function simulateUntilOver(seed) {
  const world = createWorld(seed);
  world.best = 2480;
  const input = scriptedInput();
  const steps = Math.floor(END_LIMIT_SECONDS / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    if (world.over) break;
    autopilot(world, input, 0.3);
    stepWorld(world, input, SAMPLE);
  }
  return world;
}

/** Build the world for one screenshot scene; `time` is the clock render.js draws with. */
export function sceneForShot(shot, seed) {
  if (shot === 'play') {
    const world = simulate(PLAY_SECONDS, 1, seed);
    return { world, screen: SCREEN_PLAY, time: PLAY_SECONDS };
  }
  if (shot === 'end') {
    const world = simulateUntilOver(seed);
    return { world, screen: SCREEN_OVER, time: world.time };
  }
  const world = simulate(START_SECONDS, 1, seed);
  return { world, screen: SCREEN_TITLE, time: START_SECONDS };
}
