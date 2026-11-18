// The screenshot scenes behind ?shot=start|play|upgrade|win. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (kite away from the nearest enemy and bullet, chase the nearest spark, shoot the nearest
// foe — bosses first), so the frame is what a short game really looks like and the same
// seed always gives the same frame. The autopilot picks the first draft ember, so a long
// run keeps playing through its upgrades the way a player would.
import { FIELD, STEP } from './config.js';
import { createWorld, pickUpgrade, stepWorld } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
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
 * arena, and shoot the nearest enemy — a boss or the King first, since they are the fight.
 * `skill` 1 plays to survive; 0.35 plays carelessly, so the end scene is caught out once
 * the waves speed up.
 */
function autopilot(world, input, skill) {
  const player = world.player;
  const s = input.state;
  let mx = 0;
  let my = 0;
  let target = null;
  let targetD = Infinity;
  for (const e of world.enemies) {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    const priority = e.kind === 'king' || e.kind === 'boss' ? d * 0.25 : d;
    if (priority < targetD) {
      targetD = priority;
      target = e;
    }
  }
  const nearestD = target ? Math.hypot(target.x - player.x, target.y - player.y) : Infinity;
  if (target && nearestD < 260 * skill + 60) {
    const w = (260 - Math.min(260, nearestD)) / 260;
    mx += ((player.x - target.x) / (nearestD || 1)) * w * 2;
    my += ((player.y - target.y) / (nearestD || 1)) * w * 2;
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
  if (target) {
    s.mouseX = target.x;
    s.mouseY = target.y;
    s.fire = skill > 0.5 || nearestD < 320;
  } else {
    s.fire = false;
  }
  s.dash = target !== null && nearestD < 90 && player.dashCooldown <= 0;
}

// Step the world forward; whenever a draft opens, take the first ember and keep playing.
function stepWithDrafts(world, input, skill) {
  autopilot(world, input, skill);
  stepWorld(world, input, SAMPLE);
  if (world.draftOpen) pickUpgrade(world, 0);
}

function simulate(seconds, skill, seed) {
  const world = createWorld(seed);
  world.best = 1250;
  const input = scriptedInput();
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    if (world.over || world.won) break;
    stepWithDrafts(world, input, skill);
  }
  return world;
}

// Play until `stop` says the frame is busy enough, or the cap runs out. When `autoPick`
// is false the draft stays open when it appears, so the upgrade scene can show it.
function simulateUntil(stop, skill, seed, capSeconds, autoPick = true) {
  const world = createWorld(seed);
  world.best = 2480;
  const input = scriptedInput();
  const steps = Math.floor(capSeconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    if (world.over || world.won) break;
    autopilot(world, input, skill);
    stepWorld(world, input, SAMPLE);
    if (world.draftOpen) {
      if (stop(world)) break;
      if (autoPick) pickUpgrade(world, 0);
      else break;
    }
    if (stop(world)) break;
  }
  return world;
}

function simulateUntilOver(seed) {
  const world = createWorld(seed);
  world.best = 2480;
  const input = scriptedInput();
  const steps = Math.floor(600 / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    if (world.over) break;
    stepWithDrafts(world, input, 0.3);
  }
  return world;
}

/** Build the world for one screenshot scene; `time` is the clock render.js draws with. */
export function sceneForShot(shot, seed) {
  if (shot === 'play') {
    // A busy mid-game frame: a boss fight, the arena crowded around it. The boss
    // lives long enough (and summons) that the frame stays full while it is out.
    const world = simulateUntil(
      (w) => w.enemies.some((e) => e.kind === 'boss' || e.kind === 'king') && w.enemies.length >= 3,
      1,
      seed,
      200,
    );
    return { world, screen: SCREEN_PLAY, time: world.time };
  }
  if (shot === 'upgrade') {
    // The first draft: wave 1 cleared, three embers on the table, none picked yet.
    const world = simulateUntil((w) => w.draftOpen, 1, seed, 120, false);
    return { world, screen: SCREEN_UPGRADE, time: world.time };
  }
  if (shot === 'win') {
    // The whole run: ten waves, the Ember King falls, the dawn breaks.
    const world = simulateUntil((w) => w.won, 1, seed, 600);
    return { world, screen: world.won ? SCREEN_WIN : SCREEN_OVER, time: world.time };
  }
  if (shot === 'end') {
    const world = simulateUntilOver(seed);
    return { world, screen: SCREEN_OVER, time: world.time };
  }
  const world = simulate(START_SECONDS, 1, seed);
  return { world, screen: SCREEN_TITLE, time: START_SECONDS };
}
