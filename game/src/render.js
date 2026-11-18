// Everything the player sees, drawn on one canvas. The field is a fixed logical size;
// resize() fits it into the window with letterboxing and tells input the transform.
import { COLORS, FIELD, FINAL_WAVE, PLAYER, WAVE } from './config.js';
import { upgradeDesc, upgradeIcon, upgradeName } from './upgrades.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_WIN = 'win';

// The three draft cards, laid out in a row across the field. main.js asks cardAt(x, y)
// which card a click landed on; render draws them in the same place.
const CARD_W = 240;
const CARD_H = 200;
const CARD_GAP = 24;
const CARD_Y = 218;

export function cardAt(x, y) {
  if (y < CARD_Y || y > CARD_Y + CARD_H) return -1;
  const total = CARD_W * 3 + CARD_GAP * 2;
  const x0 = (FIELD.width - total) / 2;
  for (let i = 0; i < 3; i += 1) {
    const cx = x0 + i * (CARD_W + CARD_GAP);
    if (x >= cx && x <= cx + CARD_W) return i;
  }
  return -1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let ox = 0;
  let oy = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    scale = Math.min(w / FIELD.width, h / FIELD.height);
    ox = (w - FIELD.width * scale) / 2;
    oy = (h - FIELD.height * scale) / 2;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { scale, ox, oy };
  }

  function clear() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  }

  // Ambient ember motes drifting across the floor, so the arena never feels flat.
  // Positions are a pure function of index and time: no state, deterministic per frame.
  function drawMotes(time) {
    for (let i = 0; i < 26; i += 1) {
      const x = (i * 173 + time * (9 + (i % 5) * 3)) % FIELD.width;
      const y = (i * 97 + time * (5 + (i % 4) * 2)) % FIELD.height;
      const a = 0.12 + 0.1 * Math.sin(time * 0.9 + i * 1.7);
      ctx.globalAlpha = Math.max(0.04, a);
      ctx.fillStyle = i % 3 === 0 ? COLORS.spark : COLORS.player;
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + (i % 3) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawArena(time) {
    ctx.fillStyle = COLORS.arena;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const step = 48;
    ctx.beginPath();
    for (let x = step; x < FIELD.width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
    }
    for (let y = step; y < FIELD.height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
    }
    ctx.stroke();
    drawMotes(time);
    // A slow ember glow drifting across the floor.
    const gx = (Math.sin(time * 0.11) * 0.5 + 0.5) * FIELD.width;
    const gy = (Math.cos(time * 0.07) * 0.5 + 0.5) * FIELD.height;
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, 260);
    glow.addColorStop(0, 'rgba(255, 150, 60, 0.08)');
    glow.addColorStop(1, 'rgba(255, 150, 60, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.strokeStyle = 'rgba(255, 179, 71, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, FIELD.width - 3, FIELD.height - 3);
  }

  function drawPlayer(player, time) {
    if (player.dead) return;
    const blink = player.invuln > 0 && Math.floor(time * 14) % 2 === 0;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (blink) ctx.globalAlpha = 0.35;
    // Ember trail glow.
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, player.radius * 2.4);
    glow.addColorStop(0, 'rgba(255, 179, 71, 0.5)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius * 2.4, 0, Math.PI * 2);
    ctx.fill();
    // The wisp: a flame teardrop pointing at the aim.
    ctx.rotate(player.angle);
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(player.radius + 6, 0);
    ctx.quadraticCurveTo(0, -player.radius * 0.9, -player.radius * 0.8, 0);
    ctx.quadraticCurveTo(0, player.radius * 0.9, player.radius + 6, 0);
    ctx.fill();
    ctx.fillStyle = COLORS.playerCore;
    ctx.beginPath();
    ctx.arc(2, 0, player.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    // Muzzle flash: a bright flare at the barrel for a few frames after each shot.
    if (player.muzzle > 0) {
      ctx.fillStyle = 'rgba(255, 240, 180, 0.95)';
      ctx.beginPath();
      ctx.arc(player.radius + 12, 0, 7 + player.muzzle * 40, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (player.shield) {
      ctx.strokeStyle = COLORS.shield;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 8 + Math.sin(time * 5) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (player.dashTimer > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEnemy(e, time) {
    const flash = e.flash > 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    const wob = Math.sin(e.wobble) * 0.06;
    if (e.kind === 'cinder') {
      ctx.rotate(wob);
      ctx.fillStyle = flash ? '#ffffff' : COLORS.cinder;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + time * 0.8;
        const r = e.radius * (i % 2 === 0 ? 1 : 0.72);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a0a12';
      ctx.beginPath();
      ctx.arc(-4, -2, 2.5, 0, Math.PI * 2);
      ctx.arc(5, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'dart') {
      // A dart: a sharp arrowhead that leans into its velocity.
      const va = Math.atan2(e.vy, e.vx);
      ctx.rotate(va);
      ctx.fillStyle = flash ? '#ffffff' : COLORS.dart;
      ctx.beginPath();
      ctx.moveTo(e.radius + 6, 0);
      ctx.lineTo(-e.radius * 0.7, -e.radius * 0.75);
      ctx.lineTo(-e.radius * 0.3, 0);
      ctx.lineTo(-e.radius * 0.7, e.radius * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a0a12';
      ctx.beginPath();
      ctx.arc(2, -3.5, 2, 0, Math.PI * 2);
      ctx.arc(2, 3.5, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'sniper') {
      // A sniper: a ring with a long barrel that tracks the player.
      ctx.fillStyle = flash ? '#ffffff' : COLORS.sniper;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#0d2a33';
      ctx.beginPath();
      ctx.arc(-4, -2, 2.5, 0, Math.PI * 2);
      ctx.arc(5, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'spitter') {
      ctx.fillStyle = flash ? '#ffffff' : COLORS.spitter;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5 + Math.sin(time * 6) * 1, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'brute') {
      const charging = e.chargeState === 'windup';
      ctx.rotate(Math.sin(time * 2) * 0.05);
      ctx.fillStyle = flash ? '#ffffff' : charging ? '#ff8fa3' : COLORS.brute;
      ctx.beginPath();
      ctx.moveTo(0, -e.radius);
      ctx.lineTo(e.radius * 0.9, 0);
      ctx.lineTo(0, e.radius);
      ctx.lineTo(-e.radius * 0.9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a0a12';
      ctx.beginPath();
      ctx.arc(-6, -4, 3, 0, Math.PI * 2);
      ctx.arc(6, -4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a0a12';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, 8);
      ctx.lineTo(6, 8);
      ctx.stroke();
      drawHealthBar(0, -e.radius - 12, e.radius * 2, e.health / e.maxHealth);
    } else if (e.kind === 'boss') {
      ctx.rotate(time * 0.4);
      ctx.fillStyle = flash ? '#ffffff' : COLORS.boss;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const r = e.radius * (i % 2 === 0 ? 1 : 0.78);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-time * 0.4);
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(-10, -6, 5, 0, Math.PI * 2);
      ctx.arc(10, -6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a0a12';
      ctx.beginPath();
      ctx.arc(-10, -6, 2.2, 0, Math.PI * 2);
      ctx.arc(10, -6, 2.2, 0, Math.PI * 2);
      ctx.fill();
      drawHealthBar(0, -e.radius - 16, e.radius * 2.2, e.health / e.maxHealth);
    } else if (e.kind === 'king') {
      // The Ember King: a great crowned star, gold on crimson, with a crown of flame.
      ctx.rotate(time * 0.25);
      ctx.fillStyle = flash ? '#ffffff' : COLORS.boss;
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        const r = e.radius * (i % 2 === 0 ? 1 : 0.72);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-time * 0.25);
      ctx.fillStyle = COLORS.king;
      ctx.beginPath();
      ctx.moveTo(-20, -e.radius + 6);
      ctx.lineTo(-14, -e.radius - 14);
      ctx.lineTo(-7, -e.radius + 2);
      ctx.lineTo(0, -e.radius - 18);
      ctx.lineTo(7, -e.radius + 2);
      ctx.lineTo(14, -e.radius - 14);
      ctx.lineTo(20, -e.radius + 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(-12, -6, 5.5, 0, Math.PI * 2);
      ctx.arc(12, -6, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a0a12';
      ctx.beginPath();
      ctx.arc(-12, -6, 2.4, 0, Math.PI * 2);
      ctx.arc(12, -6, 2.4, 0, Math.PI * 2);
      ctx.fill();
      drawHealthBar(0, -e.radius - 22, e.radius * 2.2, e.health / e.maxHealth);
    }
    // Embered elites wear a gold ring, so the player can tell them apart at a glance.
    if (e.elite) {
      ctx.strokeStyle = COLORS.elite;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHealthBar(x, y, w, frac) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - w / 2, y, w, 5);
    ctx.fillStyle = frac > 0.5 ? '#8dff9e' : frac > 0.25 ? '#ffe066' : '#ff4d6d';
    ctx.fillRect(x - w / 2, y, w * Math.max(0, frac), 5);
  }

  function drawBullets(bullets) {
    for (const b of bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.friendly) {
        ctx.fillStyle = COLORS.bullet;
        ctx.shadowColor = COLORS.bullet;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = COLORS.enemyBullet;
        ctx.shadowColor = COLORS.enemyBullet;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawPickups(pickups, time) {
    for (const p of pickups) {
      const bob = Math.sin(p.bob) * 2;
      const blink = p.life < 2.5 && Math.floor(time * 8) % 2 === 0;
      if (blink) continue;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      if (p.kind === 'spark') {
        ctx.fillStyle = COLORS.spark;
        ctx.shadowColor = COLORS.spark;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, -p.radius);
        ctx.lineTo(p.radius * 0.7, 0);
        ctx.lineTo(0, p.radius);
        ctx.lineTo(-p.radius * 0.7, 0);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'heart') {
        ctx.fillStyle = COLORS.heart;
        ctx.shadowColor = COLORS.heart;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.bezierCurveTo(-12, -2, -8, -12, 0, -5);
        ctx.bezierCurveTo(8, -12, 12, -2, 0, 8);
        ctx.fill();
      } else if (p.kind === 'spread') {
        ctx.fillStyle = COLORS.spread;
        ctx.shadowColor = COLORS.spread;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0d0a1a';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('×3', 0, 1);
      } else if (p.kind === 'shield') {
        ctx.strokeStyle = COLORS.shield;
        ctx.lineWidth = 3;
        ctx.shadowColor = COLORS.shield;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -p.radius);
        ctx.lineTo(p.radius * 0.85, -p.radius * 0.4);
        ctx.lineTo(p.radius * 0.6, p.radius * 0.8);
        ctx.lineTo(0, p.radius);
        ctx.lineTo(-p.radius * 0.6, p.radius * 0.8);
        ctx.lineTo(-p.radius * 0.85, -p.radius * 0.4);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawParticles(particles) {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts(texts) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.font = t.small ? 'bold 12px system-ui, sans-serif' : 'bold 16px system-ui, sans-serif';
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(world) {
    const player = world.player;
    // A backing strip across the top, so the score, wave and hearts stay readable
    // even when an ember drifts behind them.
    ctx.fillStyle = 'rgba(10, 7, 24, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, 68);
    ctx.textBaseline = 'alphabetic';
    // Score, big and top-left.
    ctx.textAlign = 'left';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(String(world.score).padStart(6, '0'), 18, 40);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`BEST ${Math.max(world.best, world.score)}`, 18, 60);
    // Wave, top-centre: the count toward the final wave, so the goal is always visible.
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    const waveLabel = world.wave <= FINAL_WAVE ? `WAVE ${Math.max(1, world.wave)} / ${FINAL_WAVE}` : `WAVE ${world.wave} — ENDLESS`;
    ctx.fillText(waveLabel, FIELD.width / 2, 34);
    if (world.spawnQueue.length > 0 || world.enemies.length > 0) {
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = COLORS.dim;
      ctx.fillText(`${world.enemies.length} embers left`, FIELD.width / 2, 54);
    } else if (world.breather > 0 && !world.over && !world.won) {
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = COLORS.spark;
      ctx.fillText(`next wave in ${Math.ceil(world.breather)}…`, FIELD.width / 2, 54);
    }
    // Hearts, top-right.
    ctx.textAlign = 'right';
    for (let i = 0; i < player.maxHealth; i += 1) {
      const x = FIELD.width - 22 - i * 30;
      const y = 30;
      ctx.fillStyle = i < player.health ? COLORS.heart : 'rgba(255, 93, 122, 0.22)';
      ctx.beginPath();
      ctx.moveTo(x, y + 7);
      ctx.bezierCurveTo(x - 10, y - 2, x - 7, y - 10, x, y - 4);
      ctx.bezierCurveTo(x + 7, y - 10, x + 10, y - 2, x, y + 7);
      ctx.fill();
    }
    if (player.shield) {
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = COLORS.shield;
      ctx.fillText('SHIELD', FIELD.width - 18, 62);
    }
    // Dash cooldown + spread timer, bottom-left.
    ctx.textAlign = 'left';
    const dashFrac = 1 - player.dashCooldown / (PLAYER.dashCooldown * player.dashCdMult);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(18, FIELD.height - 26, 120, 8);
    ctx.fillStyle = dashFrac >= 1 ? COLORS.spread : COLORS.dim;
    ctx.fillRect(18, FIELD.height - 26, 120 * dashFrac, 8);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(dashFrac >= 1 ? 'DASH READY  [Shift]' : 'DASH…', 18, FIELD.height - 34);
    if (player.spreadTimer > 0) {
      ctx.fillStyle = COLORS.spread;
      ctx.fillText(`TRIPLE FLAME ${Math.ceil(player.spreadTimer)}s`, 150, FIELD.height - 34);
    }
    // Owned embers (upgrades), bottom-centre: one icon per pick, so the build is visible.
    if (world.owned.length > 0) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillStyle = COLORS.upgrade;
      const icons = world.owned.map((id) => upgradeIcon(id)).join(' ');
      ctx.fillText(icons, FIELD.width / 2, FIELD.height - 22);
    }
    // Combo, bottom-right.
    if (world.combo > 1) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillStyle = COLORS.spark;
      ctx.fillText(`COMBO ×${world.combo}`, FIELD.width - 18, FIELD.height - 22);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(FIELD.width - 118, FIELD.height - 16, 100, 5);
      ctx.fillStyle = COLORS.spark;
      ctx.fillRect(FIELD.width - 118, FIELD.height - 16, 100 * (world.comboTimer / 3), 5);
    }
    // Boss bar.
    const boss = world.enemies.find((e) => e.kind === 'boss' || e.kind === 'king');
    if (boss) {
      const w = 420;
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillStyle = boss.kind === 'king' ? COLORS.king : COLORS.boss;
      ctx.fillText(boss.kind === 'king' ? 'THE EMBER KING' : 'THE CINDERLORD', FIELD.width / 2, 78);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(FIELD.width / 2 - w / 2, 86, w, 9);
      ctx.fillStyle = boss.kind === 'king' ? COLORS.king : COLORS.boss;
      ctx.fillRect(FIELD.width / 2 - w / 2, 86, w * Math.max(0, boss.health / boss.maxHealth), 9);
    }
    // Kill-streak callout, centre-top.
    if (world.streakText && world.streakTimer > 0) {
      ctx.globalAlpha = Math.min(1, world.streakTimer / 0.4);
      ctx.textAlign = 'center';
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.fillStyle = COLORS.spark;
      ctx.fillText(world.streakText, FIELD.width / 2, 150);
      ctx.globalAlpha = 1;
    }
    // Wave banner.
    if (world.bannerTimer > 0 && world.banner) {
      const a = Math.min(1, world.bannerTimer / 0.5, (2.2 - world.bannerTimer) / 0.4 + 0.4);
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.textAlign = 'center';
      ctx.font = 'bold 44px system-ui, sans-serif';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(world.banner, FIELD.width / 2, FIELD.height / 2 - 60);
      ctx.globalAlpha = 1;
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10, 7, 24, 0.82)';
    ctx.strokeStyle = 'rgba(255, 179, 71, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
  }

  function drawTitle(world, time) {
    ctx.fillStyle = 'rgba(10, 7, 24, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(FIELD.width / 2 - 300, 96, 600, 380);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.player;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('EMBERFALL', FIELD.width / 2, 172);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('The dark is full of embers. Keep your flame alive.', FIELD.width / 2, 204);
    ctx.fillStyle = COLORS.text;
    ctx.font = '15px system-ui, sans-serif';
    const lines = [
      'WASD / Arrows — move      Mouse — aim      Click / Space — shoot',
      'Shift — dash through danger      P — pause      M — mute',
      'Catch sparks to build your combo. Grab hearts, triple flame and shields.',
      'Clear a wave, pick an ember, grow stronger. Slay the Ember King on wave 10.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 248 + i * 26));
    const pulse = 0.65 + Math.sin(time * 4) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = COLORS.spark;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('CLICK OR PRESS ENTER TO PLAY', FIELD.width / 2, 396);
    ctx.globalAlpha = 1;
    if (world.best > 0) {
      ctx.fillStyle = COLORS.dim;
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(`BEST SCORE  ${world.best}`, FIELD.width / 2, 436);
    }
  }

  function drawPause() {
    ctx.fillStyle = 'rgba(10, 7, 24, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Press P or click to keep playing', FIELD.width / 2, FIELD.height / 2 + 30);
  }

  function drawUpgrade(world, time) {
    ctx.fillStyle = 'rgba(10, 7, 24, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.upgrade;
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText(`WAVE ${world.wave} CLEARED`, FIELD.width / 2, 150);
    ctx.fillStyle = COLORS.text;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Choose an ember — press 1, 2 or 3, or click a card.', FIELD.width / 2, 186);
    const total = CARD_W * 3 + CARD_GAP * 2;
    const x0 = (FIELD.width - total) / 2;
    const pulse = 0.85 + Math.sin(time * 3) * 0.15;
    (world.draft || []).forEach((id, i) => {
      const x = x0 + i * (CARD_W + CARD_GAP);
      const y = CARD_Y;
      ctx.fillStyle = 'rgba(20, 14, 44, 0.95)';
      ctx.strokeStyle = i === 1 ? COLORS.upgrade : 'rgba(255, 179, 71, 0.45)';
      ctx.lineWidth = i === 1 ? 3 : 2;
      ctx.beginPath();
      ctx.roundRect(x, y, CARD_W, CARD_H, 12);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = COLORS.upgrade;
      ctx.font = 'bold 44px system-ui, sans-serif';
      ctx.fillText(upgradeIcon(id), x + CARD_W / 2, y + 62);
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.text;
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillText(upgradeName(id), x + CARD_W / 2, y + 108);
      ctx.fillStyle = COLORS.dim;
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(upgradeDesc(id), x + CARD_W / 2, y + 136);
      ctx.fillStyle = COLORS.spark;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(`[ ${i + 1} ]`, x + CARD_W / 2, y + 172);
    });
    ctx.fillStyle = COLORS.dim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`Score ${world.score}  ·  Wave ${world.wave} / ${FINAL_WAVE}  ·  ${world.owned.length} embers held`, FIELD.width / 2, CARD_Y + CARD_H + 44);
  }

  function drawWin(world, time) {
    ctx.fillStyle = 'rgba(10, 7, 24, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(FIELD.width / 2 - 300, 100, 600, 380);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.king;
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('THE DAWN BREAKS', FIELD.width / 2, 176);
    ctx.fillStyle = COLORS.text;
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('The Ember King falls. Your flame lights the dark.', FIELD.width / 2, 212);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(`SCORE  ${world.score}`, FIELD.width / 2, 266);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    const rows = [
      `Waves cleared  ${FINAL_WAVE}`,
      `Embers banished  ${world.kills}`,
      `Shot accuracy  ${world.shotsFired === 0 ? 0 : Math.round((world.shotsHit / world.shotsFired) * 100)}%`,
      `Embers held  ${world.owned.length}`,
      `Best score  ${Math.max(world.best, world.score)}`,
    ];
    rows.forEach((row, i) => ctx.fillText(row, FIELD.width / 2, 306 + i * 26));
    const pulse = 0.65 + Math.sin(time * 4) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = COLORS.spark;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('PRESS R OR CLICK TO BURN AGAIN', FIELD.width / 2, 448);
    ctx.globalAlpha = 1;
  }

  function drawOver(world, time) {
    ctx.fillStyle = 'rgba(10, 7, 24, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(FIELD.width / 2 - 280, 110, 560, 360);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.danger;
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('THE FLAME DIES', FIELD.width / 2, 180);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(`SCORE  ${world.score}`, FIELD.width / 2, 240);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    const rows = [
      `Wave reached  ${world.wave} / ${FINAL_WAVE}`,
      `Embers banished  ${world.kills}`,
      `Shot accuracy  ${world.shotsFired === 0 ? 0 : Math.round((world.shotsHit / world.shotsFired) * 100)}%`,
      `Embers held  ${world.owned.length}`,
      `Best score  ${Math.max(world.best, world.score)}`,
    ];
    rows.forEach((row, i) => ctx.fillText(row, FIELD.width / 2, 282 + i * 26));
    const pulse = 0.65 + Math.sin(time * 4) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = COLORS.spark;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('PRESS R OR CLICK TO BURN AGAIN', FIELD.width / 2, 448);
    ctx.globalAlpha = 1;
  }

  return {
    resize,
    getTransform() {
      return { scale, ox, oy };
    },
    render(world, screen, time) {
      clear();
      ctx.save();
      if (world.shake > 0) {
        ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
      }
      drawArena(time);
      drawPickups(world.pickups, time);
      for (const e of world.enemies) drawEnemy(e, time);
      drawPlayer(world.player, time);
      drawBullets(world.bullets);
      drawParticles(world.particles);
      drawTexts(world.texts);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSE || screen === SCREEN_UPGRADE) drawHud(world);
      ctx.restore();
      if (screen === SCREEN_TITLE) drawTitle(world, time);
      if (screen === SCREEN_PAUSE) drawPause();
      if (screen === SCREEN_UPGRADE) drawUpgrade(world, time);
      if (screen === SCREEN_WIN) drawWin(world, time);
      if (screen === SCREEN_OVER) drawOver(world, time);
    },
  };
}
