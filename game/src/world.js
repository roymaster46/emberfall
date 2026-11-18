// The rules of Emberfall: waves, spawning, movement, collisions, scoring and the combo.
// world.js owns the state and steps it forward; it knows nothing about drawing or sound,
// it only reports events (kills, pickups, damage) for main.js to turn into sound and shake.
import { COLORS, COMBO_MAX, COMBO_WINDOW, ENEMY, FIELD, PICKUP, PLAYER, SCORE, STEP, WAVE } from './config.js';
import { burst, edgeSpawn, makeBullet, makeEnemy, makeFloatText, makePickup, makePlayer } from './entities.js';
import { mulberry32, pick, range } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_SHOOT = 1;
export const EVENT_HIT = 2;
export const EVENT_KILL = 3;
export const EVENT_BOSS_KILL = 4;
export const EVENT_PICKUP = 5;
export const EVENT_POWERUP = 6;
export const EVENT_HURT = 7;
export const EVENT_DASH = 8;
export const EVENT_WAVE = 9;
export const EVENT_BOSS = 10;
export const EVENT_OVER = 11;

export function createWorld(seed) {
  const rng = mulberry32(seed);
  return {
    rng,
    player: makePlayer(),
    enemies: [],
    bullets: [],
    pickups: [],
    particles: [],
    texts: [],
    wave: 0,
    spawnQueue: [],
    spawnTimer: 0,
    breather: 1.2,
    banner: '',
    bannerTimer: 0,
    score: 0,
    best: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    combo: 0,
    comboTimer: 0,
    time: 0,
    shake: 0,
    hitStop: 0,
    over: false,
    events: [],
  };
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function startWave(world) {
  world.wave += 1;
  const count = WAVE.baseCount + (world.wave - 1) * WAVE.perWave;
  const queue = [];
  for (let i = 0; i < count; i += 1) {
    let kind = 'cinder';
    const roll = world.rng();
    if (world.wave >= 3 && roll < 0.25) kind = 'spitter';
    else if (world.wave >= 2 && roll < 0.45) kind = 'brute';
    queue.push(kind);
  }
  if (world.wave % WAVE.bossEvery === 0) queue.push('boss');
  // Shuffle so the mix walks in from all sides.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(world.rng() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  world.spawnQueue = queue;
  world.spawnTimer = 0.4;
  world.banner = world.wave % WAVE.bossEvery === 0 ? `WAVE ${world.wave} — THE CINDERLORD` : `WAVE ${world.wave}`;
  world.bannerTimer = 2.2;
  world.events.push(world.wave % WAVE.bossEvery === 0 ? EVENT_BOSS : EVENT_WAVE);
}

function dropLoot(world, enemy) {
  const sparks = enemy.kind === 'boss' ? 12 : enemy.kind === 'brute' ? 4 : enemy.kind === 'spitter' ? 2 : 1;
  for (let i = 0; i < sparks; i += 1) {
    const p = makePickup('spark', enemy.x + range(world.rng, -18, 18), enemy.y + range(world.rng, -18, 18));
    p.vx = range(world.rng, -60, 60);
    p.vy = range(world.rng, -60, 60);
    world.pickups.push(p);
  }
  if (world.rng() < PICKUP.powerupChance) {
    const kind = pick(world.rng, ['heart', 'spread', 'shield']);
    world.pickups.push(makePickup(kind, enemy.x, enemy.y));
  }
  if (enemy.kind === 'brute') {
    for (let i = 0; i < 2; i += 1) {
      const cinder = makeEnemy('cinder', enemy.x + (i === 0 ? -24 : 24), enemy.y, world.rng);
      cinder.x = Math.max(20, Math.min(FIELD.width - 20, cinder.x));
      world.enemies.push(cinder);
    }
  }
}

function killEnemy(world, enemy, awardScore) {
  enemy.dead = true;
  world.kills += 1;
  const color = enemy.kind === 'boss' ? COLORS.boss : enemy.kind === 'brute' ? COLORS.brute : enemy.kind === 'spitter' ? COLORS.spitter : COLORS.cinder;
  burst(world.particles, enemy.x, enemy.y, enemy.kind === 'boss' ? 60 : enemy.kind === 'brute' ? 26 : 14, color, 260, 0.7);
  burst(world.particles, enemy.x, enemy.y, 8, COLORS.spark, 160, 0.5);
  world.shake = Math.max(world.shake, enemy.kind === 'boss' ? 14 : enemy.kind === 'brute' ? 8 : 4);
  world.hitStop = Math.max(world.hitStop, enemy.kind === 'boss' ? 0.12 : 0.045);
  if (awardScore) {
    const mult = Math.max(1, world.combo);
    const pts = ENEMY[enemy.kind].score * mult;
    world.score += pts;
    world.texts.push(makeFloatText(enemy.x, enemy.y - enemy.radius - 6, `+${pts}`, mult > 1 ? COLORS.spark : COLORS.text));
  }
  dropLoot(world, enemy);
  world.events.push(enemy.kind === 'boss' ? EVENT_BOSS_KILL : EVENT_KILL);
}

function hurtPlayer(world) {
  const player = world.player;
  if (player.invuln > 0 || player.dashTimer > 0 || player.dead) return;
  if (player.shield) {
    player.shield = false;
    player.invuln = 1.0;
    burst(world.particles, player.x, player.y, 18, COLORS.shield, 220, 0.6);
    world.events.push(EVENT_HIT);
    return;
  }
  player.health -= 1;
  player.invuln = PLAYER.invulnTime;
  world.combo = 0;
  world.comboTimer = 0;
  world.shake = Math.max(world.shake, 10);
  world.hitStop = Math.max(world.hitStop, 0.09);
  burst(world.particles, player.x, player.y, 22, COLORS.danger, 280, 0.7);
  world.events.push(EVENT_HURT);
  if (player.health <= 0) {
    player.dead = true;
    world.over = true;
    burst(world.particles, player.x, player.y, 70, COLORS.player, 340, 1.1);
    burst(world.particles, player.x, player.y, 30, COLORS.danger, 240, 0.9);
    world.shake = 16;
    world.events.push(EVENT_OVER);
  }
}

function stepPlayer(world, input, dt) {
  const player = world.player;
  if (player.dead) return;
  const axis = input.axis();
  player.invuln = Math.max(0, player.invuln - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.spreadTimer = Math.max(0, player.spreadTimer - dt);
  player.fireTimer -= dt;

  // Aim at the mouse; with no mouse yet, face the nearest enemy.
  const mouse = input.mouse();
  let aimX = mouse.x - player.x;
  let aimY = mouse.y - player.y;
  if (Math.hypot(aimX, aimY) < 4) {
    let nearest = null;
    let nearestD = Infinity;
    for (const e of world.enemies) {
      const d = dist2(player, e);
      if (d < nearestD) {
        nearestD = d;
        nearest = e;
      }
    }
    if (nearest) {
      aimX = nearest.x - player.x;
      aimY = nearest.y - player.y;
    }
  }
  if (Math.hypot(aimX, aimY) > 0.01) player.angle = Math.atan2(aimY, aimX);

  if (input.dashPressed() && player.dashCooldown <= 0 && player.dashTimer <= 0) {
    const dx = axis.x !== 0 || axis.y !== 0 ? axis.x : Math.cos(player.angle);
    const dy = axis.x !== 0 || axis.y !== 0 ? axis.y : Math.sin(player.angle);
    player.dashDirX = dx;
    player.dashDirY = dy;
    player.dashTimer = PLAYER.dashTime;
    player.dashCooldown = PLAYER.dashCooldown;
    world.events.push(EVENT_DASH);
  }

  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    player.vx = player.dashDirX * PLAYER.dashSpeed;
    player.vy = player.dashDirY * PLAYER.dashSpeed;
  } else {
    player.vx = axis.x * PLAYER.speed;
    player.vy = axis.y * PLAYER.speed;
  }
  player.x = Math.max(player.radius, Math.min(FIELD.width - player.radius, player.x + player.vx * dt));
  player.y = Math.max(player.radius, Math.min(FIELD.height - player.radius, player.y + player.vy * dt));

  player.trail -= dt;
  if ((Math.abs(player.vx) > 20 || Math.abs(player.vy) > 20) && player.trail <= 0) {
    player.trail = 0.03;
    world.particles.push({
      x: player.x - Math.cos(player.angle) * player.radius,
      y: player.y - Math.sin(player.angle) * player.radius,
      vx: -player.vx * 0.1,
      vy: -player.vy * 0.1,
      life: 0.35,
      maxLife: 0.35,
      size: 3,
      color: COLORS.player,
      dead: false,
    });
  }

  if (input.firing() && player.fireTimer <= 0) {
    player.fireTimer = PLAYER.fireInterval;
    const shots = player.spreadTimer > 0 ? [-0.22, 0, 0.22] : [0];
    for (const off of shots) {
      const a = player.angle + off;
      const bx = player.x + Math.cos(a) * (player.radius + 8);
      const by = player.y + Math.sin(a) * (player.radius + 8);
      world.bullets.push(makeBullet(bx, by, Math.cos(a) * PLAYER.bulletSpeed, Math.sin(a) * PLAYER.bulletSpeed, true));
    }
    world.shotsFired += 1;
    world.events.push(EVENT_SHOOT);
  }
}

function stepEnemy(world, enemy, dt) {
  const player = world.player;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const d = Math.hypot(dx, dy) || 1;
  enemy.flash = Math.max(0, enemy.flash - dt);
  enemy.wobble += dt * 3;

  if (enemy.kind === 'cinder') {
    enemy.vx = (dx / d) * enemy.speed;
    enemy.vy = (dy / d) * enemy.speed;
  } else if (enemy.kind === 'spitter') {
    if (d > 300) {
      enemy.vx = (dx / d) * enemy.speed;
      enemy.vy = (dy / d) * enemy.speed;
    } else if (d < 180) {
      enemy.vx = (-dx / d) * enemy.speed * 0.8;
      enemy.vy = (-dy / d) * enemy.speed * 0.8;
    } else {
      enemy.vx *= 0.9;
      enemy.vy *= 0.9;
    }
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && !player.dead && d < 520) {
      enemy.shootTimer = ENEMY.spitter.shootInterval * range(world.rng, 0.85, 1.2);
      const a = Math.atan2(dy, dx);
      world.bullets.push(makeBullet(enemy.x, enemy.y, Math.cos(a) * ENEMY.spitter.bulletSpeed, Math.sin(a) * ENEMY.spitter.bulletSpeed, false));
    }
  } else if (enemy.kind === 'brute') {
    if (enemy.chargeState === 'roam') {
      enemy.vx = (dx / d) * enemy.speed;
      enemy.vy = (dy / d) * enemy.speed;
      if (d < 260 && d > 60) {
        enemy.chargeState = 'windup';
        enemy.chargeTimer = ENEMY.brute.chargeWindup;
        enemy.chargeDirX = dx / d;
        enemy.chargeDirY = dy / d;
      }
    } else if (enemy.chargeState === 'windup') {
      enemy.vx *= 0.8;
      enemy.vy *= 0.8;
      enemy.chargeTimer -= dt;
      enemy.chargeDirX = dx / d;
      enemy.chargeDirY = dy / d;
      if (enemy.chargeTimer <= 0) {
        enemy.chargeState = 'charge';
        enemy.chargeTimer = 0.55;
      }
    } else {
      enemy.vx = enemy.chargeDirX * ENEMY.brute.chargeSpeed;
      enemy.vy = enemy.chargeDirY * ENEMY.brute.chargeSpeed;
      enemy.chargeTimer -= dt;
      if (enemy.chargeTimer <= 0) enemy.chargeState = 'roam';
    }
  } else if (enemy.kind === 'boss') {
    enemy.vx = (dx / d) * enemy.speed;
    enemy.vy = (dy / d) * enemy.speed;
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && !player.dead) {
      enemy.shootTimer = ENEMY.boss.shootInterval;
      const base = Math.atan2(dy, dx);
      for (let i = 0; i < 8; i += 1) {
        const a = base + (i / 8) * Math.PI * 2;
        world.bullets.push(makeBullet(enemy.x, enemy.y, Math.cos(a) * ENEMY.boss.bulletSpeed, Math.sin(a) * ENEMY.boss.bulletSpeed, false));
      }
    }
    enemy.summonTimer -= dt;
    if (enemy.summonTimer <= 0) {
      enemy.summonTimer = ENEMY.boss.summonInterval;
      for (let i = 0; i < 2; i += 1) {
        const cinder = makeEnemy('cinder', enemy.x + range(world.rng, -60, 60), enemy.y + range(world.rng, -60, 60), world.rng);
        cinder.speed *= Math.min(1.7, 1 + (world.wave - 1) * 0.035);
        world.enemies.push(cinder);
      }
    }
  }

  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.x = Math.max(enemy.radius, Math.min(FIELD.width - enemy.radius, enemy.x));
  enemy.y = Math.max(enemy.radius, Math.min(FIELD.height - enemy.radius, enemy.y));
}

function stepBullets(world, dt) {
  for (const b of world.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20 || b.life <= 0) b.dead = true;
  }
}

function stepPickups(world, dt) {
  const player = world.player;
  for (const p of world.pickups) {
    p.life -= dt;
    p.bob += dt * 4;
    if (p.life <= 0) p.dead = true;
    if (player.dead) continue;
    const d = Math.hypot(player.x - p.x, player.y - p.y);
    if (p.kind === 'spark' && d < PICKUP.sparkMagnet) {
      const pull = 420 * (1 - d / PICKUP.sparkMagnet);
      p.vx += ((player.x - p.x) / (d || 1)) * pull * dt * 4;
      p.vy += ((player.y - p.y) / (d || 1)) * pull * dt * 4;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    if (d < player.radius + p.radius + 4) {
      p.dead = true;
      if (p.kind === 'spark') {
        world.combo = Math.min(COMBO_MAX, world.combo + 1);
        world.comboTimer = COMBO_WINDOW;
        world.score += SCORE.spark * Math.max(1, world.combo);
        burst(world.particles, p.x, p.y, 4, COLORS.spark, 120, 0.35);
        world.events.push(EVENT_PICKUP);
      } else if (p.kind === 'heart') {
        player.health = Math.min(player.maxHealth, player.health + 1);
        world.texts.push(makeFloatText(player.x, player.y - 26, '+1', COLORS.heart));
        world.events.push(EVENT_POWERUP);
      } else if (p.kind === 'spread') {
        player.spreadTimer = PLAYER.spreadTime;
        world.texts.push(makeFloatText(player.x, player.y - 26, 'TRIPLE FLAME!', COLORS.spread));
        world.events.push(EVENT_POWERUP);
      } else if (p.kind === 'shield') {
        player.shield = true;
        world.texts.push(makeFloatText(player.x, player.y - 26, 'SHIELD!', COLORS.shield));
        world.events.push(EVENT_POWERUP);
      }
    }
  }
}

function collide(world) {
  const player = world.player;
  for (const b of world.bullets) {
    if (b.dead) continue;
    if (b.friendly) {
      for (const e of world.enemies) {
        if (e.dead) continue;
        const rr = e.radius + b.radius;
        if (dist2(b, e) < rr * rr) {
          b.dead = true;
          world.shotsHit += 1;
          e.health -= 1;
          e.flash = 0.12;
          burst(world.particles, b.x, b.y, 5, COLORS.bullet, 180, 0.3);
          world.events.push(EVENT_HIT);
          if (e.health <= 0) killEnemy(world, e, true);
          break;
        }
      }
    } else if (!player.dead) {
      const rr = player.radius + b.radius - 2;
      if (dist2(b, player) < rr * rr) {
        b.dead = true;
        hurtPlayer(world);
      }
    }
  }
  if (!player.dead) {
    for (const e of world.enemies) {
      if (e.dead) continue;
      const rr = e.radius + player.radius - 2;
      if (dist2(e, player) < rr * rr) {
        hurtPlayer(world);
        // Knock the enemy back so one touch is one hit, not a drain.
        const d = Math.hypot(e.x - player.x, e.y - player.y) || 1;
        e.x = player.x + ((e.x - player.x) / d) * rr;
        e.y = player.y + ((e.y - player.y) / d) * rr;
      }
    }
  }
}

function sweep(list) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].dead) list.splice(i, 1);
  }
}

// Advance the world one fixed step. `input` is the live input, or a scripted one for shots.
export function stepWorld(world, input, dt = STEP) {
  world.events.length = 0;
  if (world.over) {
    stepParticles(world, dt);
    return world.events;
  }
  world.time += dt;
  world.bannerTimer = Math.max(0, world.bannerTimer - dt);
  world.shake = Math.max(0, world.shake - dt * 26);
  world.hitStop = Math.max(0, world.hitStop - dt);
  if (world.hitStop > 0) return world.events;

  world.comboTimer -= dt;
  if (world.comboTimer <= 0) world.combo = 0;

  if (world.spawnQueue.length === 0 && world.enemies.length === 0 && !world.over) {
    world.breather -= dt;
    if (world.breather <= 0) {
      world.breather = WAVE.breather;
      startWave(world);
    }
  }
  if (world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.spawnTimer = WAVE.spawnInterval;
      const kind = world.spawnQueue.shift();
      const at = edgeSpawn(world.rng);
      const enemy = makeEnemy(kind, at.x, at.y, world.rng);
      // Later waves are faster: +3.5% speed a wave, capped at +70%.
      enemy.speed *= Math.min(1.7, 1 + (world.wave - 1) * 0.035);
      world.enemies.push(enemy);
    }
  }

  stepPlayer(world, input, dt);
  for (const e of world.enemies) stepEnemy(world, e, dt);
  stepBullets(world, dt);
  stepPickups(world, dt);
  collide(world);
  stepParticles(world, dt);
  sweep(world.enemies);
  sweep(world.bullets);
  sweep(world.pickups);
  sweep(world.particles);
  sweep(world.texts);
  if (world.score > world.best) world.best = world.score;
  return world.events;
}

function stepParticles(world, dt) {
  for (const p of world.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
    if (p.life <= 0) p.dead = true;
  }
  for (const t of world.texts) {
    t.y -= 34 * dt;
    t.life -= dt;
    if (t.life <= 0) t.dead = true;
  }
}

export function accuracy(world) {
  if (world.shotsFired === 0) return 0;
  return Math.round((world.shotsHit / world.shotsFired) * 100);
}
