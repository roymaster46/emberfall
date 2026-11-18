// Emberfall tuning: every number the game balances on lives here, so a tweak is one edit.
// The arena is a fixed logical field; render.js scales it to the window.
export const FIELD = { width: 960, height: 600 };

export const STEP = 1 / 60;

// Wave 10 is the last: the Ember King waits there. Kill him and the dawn breaks.
export const FINAL_WAVE = 10;

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
export const SCORE = { cinder: 50, spitter: 100, brute: 200, dart: 80, sniper: 150, boss: 1000, king: 5000, spark: 10 };
export const COMBO_WINDOW = 3; // seconds between spark pickups to keep the chain alive
export const COMBO_MAX = 8;

// Kill streaks: kills inside the window chain up and call out milestones.
export const STREAK_WINDOW = 4;
export const STREAK_CALLS = [
  { at: 5, text: 'RAMPAGE!', bonus: 100 },
  { at: 10, text: 'INFERNO!', bonus: 250 },
  { at: 15, text: 'CATACLYSM!', bonus: 500 },
  { at: 20, text: 'EMBERSTORM!', bonus: 1000 },
];

export const ENEMY = {
  cinder: { radius: 15, speed: 95, health: 1, score: SCORE.cinder, touch: 1 },
  spitter: { radius: 16, speed: 70, health: 2, score: SCORE.spitter, touch: 1, shootInterval: 2.4, bulletSpeed: 190 },
  brute: { radius: 26, speed: 52, health: 6, score: SCORE.brute, touch: 1, chargeSpeed: 330, chargeWindup: 0.7 },
  dart: { radius: 12, speed: 185, health: 1, score: SCORE.dart, touch: 1, zigzag: 3.2 },
  sniper: { radius: 15, speed: 62, health: 2, score: SCORE.sniper, touch: 1, shootInterval: 3.1, bulletSpeed: 300, keepRange: 340 },
  boss: { radius: 46, speed: 46, health: 60, score: SCORE.boss, touch: 2, shootInterval: 1.9, bulletSpeed: 210, summonInterval: 6 },
  king: { radius: 56, speed: 42, health: 110, score: SCORE.king, touch: 2, shootInterval: 2.1, bulletSpeed: 205, summonInterval: 7 },
};

export const WAVE = {
  baseCount: 4, // enemies in wave 1
  perWave: 2, // extra enemies per wave
  spawnInterval: 0.9, // seconds between spawns
  breather: 4, // seconds between waves
  bossEvery: 5, // a Cinderlord every 5th wave
  eliteFrom: 6, // waves at or above this can spawn embered elites
  eliteChance: 0.12, // chance a spawn is an elite (double health, double score)
  hpPerWave: 0.06, // extra enemy health per wave past wave 5, capped below
  hpCap: 1.6,
};

export const PICKUP = {
  sparkLifetime: 9,
  sparkMagnet: 130, // sparks drift toward the player inside this radius
  powerupChance: 0.16, // chance a kill drops a powerup instead of only sparks
  powerupLifetime: 10,
};

// The wave-clear draft: after every cleared wave (except the last) the player picks one
// ember. Each entry names the player stat it raises; upgrades.js owns the pool and the roll.
export const UPGRADES = {
  rapid: { name: 'RAPID ROUNDS', desc: '+18% fire rate', icon: '»' },
  heavy: { name: 'HEAVY EMBERS', desc: '+1 bullet damage', icon: '◆' },
  pierce: { name: 'PIERCING FLAME', desc: 'Bullets pass through +1 enemy', icon: '→' },
  swift: { name: 'SWIFT WISP', desc: '+12% move speed', icon: '≫' },
  magnet: { name: 'SPARK MAGNET', desc: '+60% spark pickup radius', icon: '◎' },
  heart: { name: 'EMBER HEART', desc: '+1 max health, heal 1', icon: '♥' },
  dash: { name: 'QUICK DASH', desc: '-25% dash cooldown', icon: '↯' },
  aegis: { name: 'AEGIS EMBER', desc: 'Start every wave with a shield', icon: '⬢' },
};
export const DRAFT_SIZE = 3;

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
  dart: '#ffb347',
  sniper: '#5ee6ff',
  boss: '#ff2e63',
  king: '#ffd700',
  elite: '#ffe066',
  spark: '#ffe066',
  heart: '#ff5d7a',
  spread: '#7ae0ff',
  shield: '#8dff9e',
  text: '#f5efff',
  dim: '#a99ec7',
  danger: '#ff4d6d',
  upgrade: '#ffb347',
};
