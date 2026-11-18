// The wave-clear draft: after a wave is cleared the player picks one ember from three.
// upgrades.js owns the pool (names live in config.js), the roll, and what each pick does
// to the player. Picks are permanent for the run and stack, except Aegis (once) and Heart
// (capped by max health), which the roll skips once they stop helping.
import { DRAFT_SIZE, UPGRADES } from './config.js';

const POOL = ['rapid', 'heavy', 'pierce', 'swift', 'magnet', 'heart', 'dash', 'aegis'];
const MAX_HEALTH_CAP = 8;

/** True when this upgrade would still help the player who owns `owned`. */
export function upgradeOffered(id, player, owned) {
  if (id === 'aegis') return !owned.includes('aegis');
  if (id === 'heart') return player.maxHealth < MAX_HEALTH_CAP;
  return true;
}

/** Roll DRAFT_SIZE distinct upgrades the player can still use. */
export function rollUpgrades(rng, player, owned) {
  const usable = POOL.filter((id) => upgradeOffered(id, player, owned));
  // Shuffle with the world's seeded rng so a shot scene always drafts the same three.
  for (let i = usable.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [usable[i], usable[j]] = [usable[j], usable[i]];
  }
  return usable.slice(0, DRAFT_SIZE);
}

/** Apply one pick to the player. `owned` records the pick for the next roll. */
export function applyUpgrade(player, id, owned) {
  owned.push(id);
  if (id === 'rapid') player.fireRate *= 1.18;
  else if (id === 'heavy') player.damage += 1;
  else if (id === 'pierce') player.pierce += 1;
  else if (id === 'swift') player.speedMult *= 1.12;
  else if (id === 'magnet') player.magnetMult *= 1.6;
  else if (id === 'heart') {
    player.maxHealth = Math.min(MAX_HEALTH_CAP, player.maxHealth + 1);
    player.health = Math.min(player.maxHealth, player.health + 1);
  } else if (id === 'dash') player.dashCdMult *= 0.75;
  else if (id === 'aegis') player.aegis = true;
}

export function upgradeName(id) {
  return UPGRADES[id].name;
}

export function upgradeDesc(id) {
  return UPGRADES[id].desc;
}

export function upgradeIcon(id) {
  return UPGRADES[id].icon;
}
