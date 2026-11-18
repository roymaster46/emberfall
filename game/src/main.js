// Emberfall's entry point: the loop, the state machine and the wiring between input, world,
// audio and render. In shot mode (?shot=start|play|upgrade|win&seed=N) it renders one
// deterministic scene and sets window.__shotReady so the screenshot script knows the frame
// is done.
//
// Screens: title → play → upgrade (after each cleared wave, pick one ember) → … → win
// (the Ember King falls on wave 10) or over (the flame dies). Pause sits over play.
import { FIELD, STEP } from './config.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { cardAt, createRenderer, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';
import { createWorld, pickUpgrade, stepWorld } from './world.js';
import { sceneForShot } from './shots.js';

const BEST_KEY = 'emberfall-best';
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || '1') || 1;

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || '0') || 0;
  } catch {
    return 0;
  }
}

function saveBest(best) {
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Private mode or no storage: the score just lives for this session.
  }
}

if (shot) {
  // Deterministic screenshot scene: no loop, no audio, one frame.
  const { world, screen, time } = sceneForShot(shot, seed);
  const t = renderer.resize();
  input.setTransform(t.scale, t.ox, t.oy);
  renderer.render(world, screen, time);
  window.__shotReady = true;
} else {
  let world = createWorld((Date.now() % 2147483647) | 0);
  world.best = loadBest();
  let screen = SCREEN_TITLE;
  let last = performance.now();
  let acc = 0;
  let muted = false;

  function newGame() {
    world = createWorld((Date.now() % 2147483647) | 0);
    world.best = loadBest();
    screen = SCREEN_PLAY;
  }

  function togglePause() {
    if (screen === SCREEN_PLAY) screen = SCREEN_PAUSE;
    else if (screen === SCREEN_PAUSE) screen = SCREEN_PLAY;
  }

  function handleEvents(events) {
    for (const event of events) {
      if (event === 1) audio.shoot();
      else if (event === 2) audio.hit();
      else if (event === 3) audio.explode();
      else if (event === 4) audio.bossExplode();
      else if (event === 5) audio.pickup();
      else if (event === 6) audio.powerup();
      else if (event === 7) audio.hurt();
      else if (event === 8) audio.dash();
      else if (event === 9) audio.wave();
      else if (event === 10) audio.boss();
      else if (event === 11) audio.gameOver();
      else if (event === 12) audio.draft();
      else if (event === 13) audio.upgrade();
      else if (event === 14) audio.victory();
      else if (event === 15) audio.streak();
    }
  }

  function keydown(event) {
    if (event.code === 'Enter' && screen === SCREEN_TITLE) {
      audio.unlock();
      newGame();
    } else if (event.code === 'KeyR' && (screen === SCREEN_OVER || screen === SCREEN_WIN || screen === SCREEN_PLAY)) {
      audio.unlock();
      newGame();
    } else if (event.code === 'KeyP' && (screen === SCREEN_PLAY || screen === SCREEN_PAUSE)) {
      togglePause();
    } else if (event.code === 'Escape' && (screen === SCREEN_PLAY || screen === SCREEN_PAUSE)) {
      togglePause();
    } else if (event.code === 'KeyM') {
      muted = audio.toggleMute();
      void muted;
    } else if (screen === SCREEN_UPGRADE) {
      // Pick an ember with 1, 2 or 3.
      const pick = event.code === 'Digit1' ? 0 : event.code === 'Digit2' ? 1 : event.code === 'Digit3' ? 2 : -1;
      if (pick >= 0 && pickUpgrade(world, pick)) {
        audio.upgrade();
        screen = SCREEN_PLAY;
      }
    }
  }
  window.addEventListener('keydown', keydown);
  window.addEventListener('resize', () => {
    const t = renderer.resize();
    input.setTransform(t.scale, t.ox, t.oy);
  });

  function frame(now) {
    const t = renderer.resize();
    input.setTransform(t.scale, t.ox, t.oy);
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    // Clicks during play are for firing, not for menus: drain them so a stale click
    // cannot instantly unpause or restart the moment a menu appears.
    if (screen === SCREEN_PLAY) input.consumeClick();

    if (screen === SCREEN_TITLE && input.consumeClick()) {
      audio.unlock();
      newGame();
    } else if ((screen === SCREEN_OVER || screen === SCREEN_WIN) && input.consumeClick()) {
      audio.unlock();
      newGame();
    } else if (screen === SCREEN_PAUSE && input.consumeClick()) {
      togglePause();
    } else if (screen === SCREEN_UPGRADE && input.consumeClick()) {
      // Click a draft card to pick that ember.
      const m = input.mouse();
      const pick = cardAt(m.x, m.y);
      if (pick >= 0 && pickUpgrade(world, pick)) {
        audio.upgrade();
        screen = SCREEN_PLAY;
      }
    }

    if (screen === SCREEN_PLAY) {
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        const events = stepWorld(world, input, STEP);
        handleEvents(events);
        // The music follows the fight: boss waves and late waves play hotter.
        audio.setIntensity(world.enemies.some((e) => e.kind === 'boss' || e.kind === 'king') || world.wave >= 7 ? 1 : 0);
        if (world.draftOpen) {
          screen = SCREEN_UPGRADE;
          break;
        }
        if (world.won) {
          screen = SCREEN_WIN;
          saveBest(Math.max(world.best, world.score));
          break;
        }
        if (world.over) {
          screen = SCREEN_OVER;
          saveBest(Math.max(world.best, world.score));
          break;
        }
      }
      // A live title behind the game over is not needed; the arena keeps its embers.
    }

    renderer.render(world, screen, now / 1000);
    requestAnimationFrame(frame);
  }

  renderer.resize();
  requestAnimationFrame(frame);
}
