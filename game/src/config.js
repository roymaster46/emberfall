// Emberfall tuning: every number the game balances on lives here, so a tweak is one edit.
// The arena is a fixed logical field; render.js scales it to the window.
export const FIELD = { width: 960, height: 600 };

export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 265,
  fireInterval: 0.16,
  bulletSpeed: 560,
  bulletRadius: 5,
  maxHealth: 5,
  startHealth: 3,
  dashSpeed: 780,
  dashTime: 0.16,
  dashCooldown: 1.6,
  invulnTime: 1.0,
  spreadTime: 12,
};

// Points per kill, before the combo multiplier.
export const SCORE = { cinder: 50, spitter: 100, brute: 200, boss: 1000, spark: 10 };
export const COMBO_WINDOW = 3; // seconds between spark pickups to keep the chain alive
export const COMBO_MAX = 8;

export const ENEMY = {
  cinder: { radius: 15, speed: 95, health: 1, score: SCORE.cinder, touch: 1 },
  spitter: { radius: 16, speed: 70, health: 2, score: SCORE.spitter, touch: 1, shootInterval: 2.4, bulletSpeed: 190 },
  brute: { radius: 26, speed: 52, health: 6, score: SCORE.brute, touch: 1, chargeSpeed: 330, chargeWindup: 0.7 },
  boss: { radius: 46, speed: 46, health: 60, score: SCORE.boss, touch: 2, shootInterval: 1.9, bulletSpeed: 210, summonInterval: 6 },
};

export const WAVE = {
  baseCount: 4, // enemies in wave 1
  perWave: 2, // extra enemies per wave
  spawnInterval: 0.9, // seconds between spawns
  breather: 4, // seconds between waves
  bossEvery: 5, // a Cinderlord every 5th wave
};

export const PICKUP = {
  sparkLifetime: 9,
  sparkMagnet: 130, // sparks drift toward the player inside this radius
  powerupChance: 0.16, // chance a kill drops a powerup instead of only sparks
  powerupLifetime: 10,
};

export const COLORS = {
  bg: '#0d0a1a',
  bgEdge: '#171029',
  arena: '#14102a',
  grid: 'rgba(148, 120, 255, 0.07)',
  player: '#ffb347',
  playerCore: '#fff3c4',
  bullet: '#ffd76a',
  enemyBullet: '#ff5d7a',
  cinder: '#ff6b4a',
  spitter: '#c86bff',
  brute: '#ff3d5e',
  boss: '#ff2e63',
  spark: '#ffe066',
  heart: '#ff5d7a',
  spread: '#7ae0ff',
  shield: '#8dff9e',
  text: '#f5efff',
  dim: '#a99ec7',
  danger: '#ff4d6d',
};
