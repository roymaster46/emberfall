// The things that live in the arena. Entities are plain objects; world.js moves them and
// resolves their collisions, render.js draws them. Nothing here touches the DOM or audio.
import { ENEMY, FIELD, PLAYER } from './config.js';
import { range } from './random.js';

export function makePlayer() {
  return {
    kind: 'player',
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    angle: -Math.PI / 2,
    health: PLAYER.startHealth,
    maxHealth: PLAYER.maxHealth,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: 0,
    dashDirY: -1,
    invuln: 0,
    spreadTimer: 0,
    shield: false,
    trail: 0,
    dead: false,
  };
}

export function makeEnemy(kind, x, y, rng) {
  const spec = ENEMY[kind];
  const enemy = {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: spec.radius,
    health: spec.health,
    maxHealth: spec.health,
    speed: spec.speed * range(rng, 0.9, 1.1),
    shootTimer: range(rng, 1, (spec.shootInterval ?? 2.4)),
    summonTimer: spec.summonInterval ?? 0,
    chargeState: 'roam', // roam | windup | charge
    chargeTimer: 0,
    chargeDirX: 0,
    chargeDirY: 0,
    flash: 0,
    wobble: range(rng, 0, Math.PI * 2),
    dead: false,
  };
  return enemy;
}

// A spawn point just outside one edge, so enemies walk in instead of popping up.
export function edgeSpawn(rng) {
  const side = Math.floor(rng() * 4);
  const m = 30;
  if (side === 0) return { x: range(rng, 0, FIELD.width), y: -m };
  if (side === 1) return { x: FIELD.width + m, y: range(rng, 0, FIELD.height) };
  if (side === 2) return { x: range(rng, 0, FIELD.width), y: FIELD.height + m };
  return { x: -m, y: range(rng, 0, FIELD.height) };
}

export function makeBullet(x, y, vx, vy, friendly) {
  return {
    kind: 'bullet',
    x,
    y,
    vx,
    vy,
    radius: friendly ? PLAYER.bulletRadius : 7,
    friendly,
    life: 2.2,
    dead: false,
  };
}

export function makePickup(kind, x, y) {
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: kind === 'spark' ? 7 : 13,
    life: kind === 'spark' ? 9 : 10,
    bob: Math.random() * Math.PI * 2,
    dead: false,
  };
}

export function makeParticle(x, y, vx, vy, life, size, color) {
  return { x, y, vx, vy, life, maxLife: life, size, color, dead: false };
}

export function makeFloatText(x, y, text, color) {
  return { x, y, text, color, life: 0.9, maxLife: 0.9, dead: false };
}

export function burst(particles, x, y, count, color, speed, life) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const v = speed * (0.4 + Math.random() * 0.8);
    particles.push(makeParticle(x, y, Math.cos(angle) * v, Math.sin(angle) * v, life * (0.6 + Math.random() * 0.7), 2 + Math.random() * 3, color));
  }
}
