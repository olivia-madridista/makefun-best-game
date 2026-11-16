// Everything drawn is drawn here: the vale, its creatures and lanterns, the HUD and the
// screens between play. Canvas 2D only, no images — shapes, gradients and the vale's
// palette from config.js. Nothing here keeps state; main.js hands over the world and
// the screen, and this module paints exactly that, which is what makes the ?shot=
// screenshot modes honest renders of the game itself.

import { VIEW_WIDTH, VIEW_HEIGHT, TILE, PALETTES, START_HEARTS } from './config.js';
import { tileHash } from './random.js';

const FONT = "'Trebuchet MS', 'Segoe UI', Verdana, sans-serif";
const FONT_DISPLAY = "Georgia, 'Times New Roman', serif";

function paletteOf(world) {
  return PALETTES[world.def.palette] ?? PALETTES[0];
}

function ridge(ctx, camX, factor, baseY, amp, color, seed) {
  const off = camX * factor;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-4, VIEW_HEIGHT);
  for (let x = -4; x <= VIEW_WIDTH + 16; x += 16) {
    const wx = x + off;
    const y = baseY
      - Math.sin(wx * 0.006 + seed) * amp
      - Math.sin(wx * 0.017 + seed * 2.7) * amp * 0.36
      - Math.sin(wx * 0.041 + seed * 5.1) * amp * 0.12;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(VIEW_WIDTH + 4, VIEW_HEIGHT);
  ctx.closePath();
  ctx.fill();
}

function drawSky(ctx, world) {
  const pal = paletteOf(world);
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  grad.addColorStop(0, pal.skyTop);
  grad.addColorStop(0.55, pal.skyMid);
  grad.addColorStop(1, pal.skyLow);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  // Stars come out as the sky darkens: a fixed field, twinkling off the level clock.
  if (pal.name !== 'dawn') {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 70; i += 1) {
      const sx = tileHash(i, 7) * VIEW_WIDTH;
      const sy = tileHash(i, 13) * VIEW_HEIGHT * 0.5;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(world.levelTime * 0.7 + i * 1.7));
      ctx.globalAlpha = (pal.name === 'night' ? 0.85 : 0.4) * tw;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // The low sun (or the moon, at night) rides slow parallax behind the hills.
  const sunX = VIEW_WIDTH * 0.72 - world.camera.x * 0.05;
  const sunY = pal.name === 'night' ? 92 : 150;
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 120);
  glow.addColorStop(0, pal.sun);
  glow.addColorStop(0.25, pal.sun + 'aa');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
  ctx.fillStyle = pal.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, pal.name === 'night' ? 26 : 38, 0, Math.PI * 2);
  ctx.fill();
  if (pal.name === 'night') {
    ctx.fillStyle = pal.skyTop;
    ctx.beginPath();
    ctx.arc(sunX + 12, sunY - 6, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  ridge(ctx, world.camera.x, 0.25, 415, 52, pal.hillsFar, 1.3);
  ridge(ctx, world.camera.x, 0.5, 470, 38, pal.hillsNear, 4.1);
}

function drawTile(ctx, world, tx, ty) {
  const pal = paletteOf(world);
  const ch = world.tileAt(tx, ty);
  const x = tx * TILE;
  const y = ty * TILE;
  if (ch === '#') {
    ctx.fillStyle = pal.earth;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = pal.earthDark;
    const n = tileHash(tx, ty);
    ctx.fillRect(x + 4 + n * 18, y + 14 + tileHash(ty, tx) * 12, 5, 4);
    ctx.fillRect(x + 20 - n * 12, y + 22, 4, 3);
    // Moss crowns any face with open air above it.
    if (!world.isSolid(tx, ty - 1)) {
      ctx.fillStyle = pal.moss;
      ctx.fillRect(x, y, TILE, 9);
      ctx.fillStyle = pal.mossDark;
      ctx.fillRect(x, y + 7, TILE, 3);
      ctx.fillRect(x + 6 + n * 16, y + 9, 3, 5);
      ctx.fillRect(x + 22 - n * 10, y + 9, 3, 4);
    }
  } else if (ch === 'X') {
    ctx.fillStyle = pal.stone;
    ctx.fillRect(x + 1, y + 3, TILE - 2, TILE - 6);
    ctx.fillStyle = pal.stoneDark;
    ctx.fillRect(x + 1, y + TILE - 7, TILE - 2, 4);
    ctx.fillRect(x + 5, y + 7, 3, 3);
    ctx.fillRect(x + TILE - 8, y + 7, 3, 3);
    ctx.fillStyle = pal.moss;
    ctx.fillRect(x + 1, y + 3, TILE - 2, 4);
  } else if (ch === '^') {
    ctx.fillStyle = '#3d2b33';
    ctx.fillRect(x + 2, y + TILE - 6, TILE - 4, 6);
    ctx.fillStyle = '#c9ced6';
    for (let i = 0; i < 3; i += 1) {
      const bx = x + 4 + i * 9;
      ctx.beginPath();
      ctx.moveTo(bx, y + TILE - 5);
      ctx.lineTo(bx + 4.5, y + 12);
      ctx.lineTo(bx + 9, y + TILE - 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#8f96a3';
    ctx.fillRect(x + 8, y + 22, 3, 6);
    ctx.fillRect(x + 21, y + 20, 3, 8);
  }
}

function drawLanternPost(ctx, x, y, lit, accent, big = false) {
  const s = big ? 1.6 : 1;
  ctx.strokeStyle = '#2c2333';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(x, y + TILE * s);
  ctx.lineTo(x, y + 6 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y + 6 * s);
  ctx.quadraticCurveTo(x, y - 2 * s, x + 7 * s, y - 1 * s);
  ctx.stroke();
  const lx = x + 8 * s;
  const ly = y + 7 * s;
  if (lit) {
    const glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 30 * s);
    glow.addColorStop(0, accent);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(lx - 32 * s, ly - 32 * s, 64 * s, 64 * s);
  }
  ctx.fillStyle = lit ? accent : '#5a5f73';
  ctx.beginPath();
  ctx.arc(lx, ly, 5.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2c2333';
  ctx.lineWidth = 1.6 * s;
  ctx.strokeRect(lx - 6.5 * s, ly - 8 * s, 13 * s, 16 * s);
}

function drawShard(ctx, world, shard) {
  const pal = paletteOf(world);
  const bob = Math.sin(world.levelTime * 2.4 + shard.phase) * 3;
  const x = shard.x;
  const y = shard.y + bob;
  const pulse = 0.75 + 0.25 * Math.sin(world.levelTime * 3.2 + shard.phase);
  const glow = ctx.createRadialGradient(x, y, 1, x, y, 20);
  glow.addColorStop(0, pal.accent);
  glow.addColorStop(1, 'transparent');
  ctx.globalAlpha = 0.5 * pulse;
  ctx.fillStyle = glow;
  ctx.fillRect(x - 20, y - 20, 40, 40);
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(world.levelTime * 1.8 + shard.phase) * 0.35);
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(6.5, 0);
  ctx.lineTo(0, 10);
  ctx.lineTo(-6.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff6cf';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(3.5, 0);
  ctx.lineTo(0, 6);
  ctx.lineTo(-3.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSpring(ctx, spring) {
  const squash = spring.squash;
  const x = spring.x;
  const baseY = spring.y + TILE;
  const coilH = 12 - squash * 6;
  ctx.strokeStyle = '#7d8590';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 8, baseY);
  ctx.lineTo(x + 24, baseY - coilH * 0.4);
  ctx.lineTo(x + 8, baseY - coilH * 0.7);
  ctx.lineTo(x + 24, baseY - coilH);
  ctx.stroke();
  ctx.fillStyle = '#d95f43';
  ctx.fillRect(x + 3, baseY - coilH - 6, TILE - 6, 6);
  ctx.fillStyle = '#f08a5d';
  ctx.fillRect(x + 3, baseY - coilH - 6, TILE - 6, 2);
  ctx.fillStyle = '#4a3542';
  ctx.fillRect(x + 6, baseY - 2, TILE - 12, 3);
}

function drawBeetle(ctx, b) {
  const cx = b.x + b.w / 2;
  const baseY = b.y + b.h;
  ctx.strokeStyle = '#241a20';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 3; i += 1) {
    const lx = b.x + 5 + i * 8;
    const lift = Math.sin(b.animPhase + i * 2.1) * 2.4;
    ctx.beginPath();
    ctx.moveTo(lx, baseY - 5);
    ctx.lineTo(lx - 2, baseY + Math.max(0, lift));
    ctx.moveTo(lx + 3, baseY - 5);
    ctx.lineTo(lx + 5, baseY + Math.max(0, -lift));
    ctx.stroke();
  }
  ctx.fillStyle = '#6e2434';
  ctx.beginPath();
  ctx.ellipse(cx, b.y + 11, b.w / 2, 10, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(b.x, b.y + 10, b.w, 3);
  ctx.strokeStyle = '#471623';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx, b.y + 2);
  ctx.lineTo(cx, b.y + 11);
  ctx.moveTo(cx - 7, b.y + 4);
  ctx.quadraticCurveTo(cx - 8, b.y + 8, cx - 7, b.y + 12);
  ctx.moveTo(cx + 7, b.y + 4);
  ctx.quadraticCurveTo(cx + 8, b.y + 8, cx + 7, b.y + 12);
  ctx.stroke();
  // Thorn horns and two amber eyes, aimed the way it walks.
  ctx.fillStyle = '#c9ced6';
  const dir = b.dir;
  ctx.beginPath();
  ctx.moveTo(cx + dir * 10, b.y + 4);
  ctx.lineTo(cx + dir * 16, b.y - 3);
  ctx.lineTo(cx + dir * 13, b.y + 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffb347';
  ctx.fillRect(cx + dir * 8 - 1.5, b.y + 7, 3, 3);
  ctx.fillRect(cx + dir * 3 - 1.5, b.y + 7, 3, 3);
}

function drawWren(ctx, world) {
  const p = world.player;
  const pal = paletteOf(world);
  if (p.invincible > 0 && Math.floor(world.time * 14) % 2 === 0 && !world.levelDone) {
    ctx.globalAlpha = 0.35;
  }
  const cx = p.x + p.w / 2;
  const feet = p.y + p.h;
  const running = p.onGround && Math.abs(p.vx) > 25;
  const legSwing = running ? Math.sin(p.animTime * 14) * 5 : 0;

  // Boots.
  ctx.fillStyle = '#33302e';
  if (p.onGround) {
    ctx.fillRect(cx - 8 + legSwing, feet - 4, 7, 4);
    ctx.fillRect(cx + 1 - legSwing, feet - 4, 7, 4);
  } else {
    ctx.fillRect(cx - 8, feet - 5, 7, 4);
    ctx.fillRect(cx + 2, feet - 3, 7, 4);
  }
  // Cloak: a moss-green hood and coat, bell-shaped, with a gold clasp.
  ctx.fillStyle = '#3f7d5a';
  ctx.beginPath();
  ctx.moveTo(cx - 10, feet - 3);
  ctx.quadraticCurveTo(cx - 11, p.y + 8, cx - 6, p.y + 3);
  ctx.quadraticCurveTo(cx, p.y - 3, cx + 6, p.y + 3);
  ctx.quadraticCurveTo(cx + 11, p.y + 8, cx + 10, feet - 3);
  ctx.quadraticCurveTo(cx, feet + 1, cx - 10, feet - 3);
  ctx.fill();
  ctx.fillStyle = '#356b4d';
  ctx.fillRect(cx - 10, feet - 9, 20, 3);
  // Face in the hood's shadow, and a russet scarf trailing against the run.
  ctx.fillStyle = '#f2c894';
  ctx.beginPath();
  ctx.arc(cx + p.face * 1.5, p.y + 10, 5.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d2b24';
  ctx.fillRect(cx + p.face * 3.4, p.y + 8.6, 1.8, 2.6);
  ctx.fillStyle = '#d95f43';
  ctx.beginPath();
  ctx.moveTo(cx - p.face * 4, p.y + 13);
  ctx.lineTo(cx - p.face * (13 + (running ? Math.sin(p.animTime * 14) * 2 : 0)), p.y + 16);
  ctx.lineTo(cx - p.face * 4, p.y + 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.accent;
  ctx.fillRect(cx - 1.6, p.y + 15, 3.2, 3.2);
  // The hand lantern, swung ahead of the run: Wren's own little sun.
  const lx = cx + p.face * 14;
  const ly = p.y + 19 + (p.onGround ? 0 : -2);
  ctx.strokeStyle = '#2c2333';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx + p.face * 7, p.y + 15);
  ctx.lineTo(lx, ly - 4);
  ctx.stroke();
  const glow = ctx.createRadialGradient(lx, ly, 1, lx, ly, 26);
  glow.addColorStop(0, pal.accent);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(lx - 26, ly - 26, 52, 52);
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.arc(lx, ly, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeRect(lx - 5, ly - 6.4, 10, 12.8);
  ctx.globalAlpha = 1;
}

function drawParticles(ctx, world) {
  for (const pt of world.particles) {
    const t = 1 - pt.life / pt.maxLife;
    ctx.globalAlpha = Math.max(0, t);
    ctx.fillStyle = pt.kind === 'spark' ? '#ffd75e' : pt.kind === 'dust' ? '#cbb59a' : '#b9b3c9';
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

/** The vale itself: sky, tiles, things and Wren, through the camera. */
export function drawWorld(ctx, world) {
  drawSky(ctx, world);
  ctx.save();
  ctx.translate(-Math.round(world.camera.x), -Math.round(world.camera.y));
  const camL = Math.floor(world.camera.x / TILE) - 1;
  const camR = camL + Math.ceil(VIEW_WIDTH / TILE) + 2;
  for (let ty = 0; ty < 17; ty += 1) {
    for (let tx = camL; tx <= camR; tx += 1) drawTile(ctx, world, tx, ty);
  }
  for (const plat of world.platforms) {
    ctx.fillStyle = '#6d4c33';
    ctx.fillRect(plat.px, plat.py, plat.wPx, plat.hPx);
    ctx.fillStyle = '#7fae4c';
    ctx.fillRect(plat.px, plat.py, plat.wPx, 5);
    ctx.fillStyle = '#54382a';
    ctx.fillRect(plat.px + 6, plat.py + 9, 4, 4);
    ctx.fillRect(plat.px + plat.wPx - 10, plat.py + 9, 4, 4);
  }
  for (const spring of world.springs) drawSpring(ctx, spring);
  for (const cp of world.checkpoints) {
    drawLanternPost(ctx, cp.x + 4, cp.y, cp.lit, paletteOf(world).accent);
  }
  if (world.goal) {
    // The Great Lantern is drawn at 1.6 scale; anchor it so its post foot lands
    // exactly on the ground its tile stands on.
    drawLanternPost(ctx, world.goal.x + 2, world.goal.y - 19, true, paletteOf(world).accent, true);
  }
  for (const shard of world.shardList) if (!shard.taken) drawShard(ctx, world, shard);
  for (const b of world.beetles) if (b.alive) drawBeetle(ctx, b);
  drawParticles(ctx, world);
  drawWren(ctx, world);
  ctx.restore();
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function heart(ctx, x, y, filled) {
  ctx.fillStyle = filled ? '#e0483e' : 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(x, y + 5);
  ctx.bezierCurveTo(x - 9, y - 4, x - 4, y - 11, x, y - 5);
  ctx.bezierCurveTo(x + 4, y - 11, x + 9, y - 4, x, y + 5);
  ctx.fill();
}

/** Score, hearts, shards and the clock, over the vale. */
export function drawHUD(ctx, world, muted) {
  ctx.fillStyle = 'rgba(16,12,28,0.42)';
  ctx.fillRect(0, 0, VIEW_WIDTH, 44);
  for (let i = 0; i < START_HEARTS; i += 1) heart(ctx, 30 + i * 26, 24, i < world.hearts);
  ctx.fillStyle = '#f5efdd';
  ctx.font = `600 15px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(world.def.name, 108, 21);
  ctx.font = `400 12px ${FONT}`;
  ctx.fillStyle = 'rgba(245,239,221,0.75)';
  ctx.fillText(world.def.subtitle, 108, 38);
  ctx.textAlign = 'right';
  ctx.font = `700 19px ${FONT}`;
  ctx.fillStyle = '#ffd75e';
  ctx.fillText(String(world.score).padStart(6, '0'), VIEW_WIDTH - 24, 27);
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = '#f5efdd';
  ctx.fillText(`◆ ${world.shardsThisLevel}/${world.levelShardCount}    ⏱ ${fmtTime(world.time)}${muted ? '    🔇 M' : ''}`, VIEW_WIDTH - 24, 43 - 2);
  ctx.textAlign = 'left';
}

function dim(ctx, alpha = 0.55) {
  ctx.fillStyle = `rgba(10,8,20,${alpha})`;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}

function centerText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW_WIDTH / 2, y);
  ctx.textAlign = 'left';
}

export function drawTitleScreen(ctx, world) {
  drawWorld(ctx, world);
  dim(ctx, 0.38);
  const pal = paletteOf(world);
  centerText(ctx, 'M O S S L I G H T', 168, `64px ${FONT_DISPLAY}`, '#ffe9a8');
  centerText(ctx, 'The lamps of the three vales have gone dark.', 208, `italic 19px ${FONT_DISPLAY}`, '#f5efdd');
  centerText(ctx, 'Guide Wren, the last lantern-keeper, across Dawn Hollow, Fernfall Grotto', 262, `16px ${FONT}`, '#f5efdd');
  centerText(ctx, 'and Ember Peak. Gather sunshards, mind the thornbeetles, and relight', 286, `16px ${FONT}`, '#f5efdd');
  centerText(ctx, 'each vale’s Great Lantern.', 310, `16px ${FONT}`, '#f5efdd');
  centerText(ctx, '▶  Press Enter or click to begin', 372, `700 21px ${FONT}`, pal.accent);
  centerText(ctx, 'Move: ← → or A / D      Jump: Space / W / ↑ (hold for higher)      Pause: P      Mute: M', 428, `14px ${FONT}`, 'rgba(245,239,221,0.85)');
  centerText(ctx, 'Stomp beetles from above. Springs bounce. Lit lanterns are checkpoints.', 454, `14px ${FONT}`, 'rgba(245,239,221,0.85)');
}

export function drawPauseScreen(ctx, world) {
  drawWorld(ctx, world);
  dim(ctx);
  centerText(ctx, 'Paused', 240, `44px ${FONT_DISPLAY}`, '#ffe9a8');
  centerText(ctx, 'P or Esc to resume · R to restart the run · M to mute', 292, `16px ${FONT}`, '#f5efdd');
}

export function drawClearScreen(ctx, world) {
  drawWorld(ctx, world);
  dim(ctx, 0.45);
  centerText(ctx, `${world.def.name} relit!`, 226, `42px ${FONT_DISPLAY}`, '#ffe9a8');
  centerText(ctx, `Sunshards ${world.shardsThisLevel}/${world.levelShardCount} · Score ${world.score}`, 276, `18px ${FONT}`, '#f5efdd');
  centerText(ctx, 'Press Enter for the next vale', 330, `700 19px ${FONT}`, paletteOf(world).accent);
}

export function drawWinScreen(ctx, world, timeBonus) {
  drawWorld(ctx, world);
  dim(ctx, 0.5);
  centerText(ctx, 'All three vales shine again', 190, `44px ${FONT_DISPLAY}`, '#ffe9a8');
  centerText(ctx, 'Wren hangs the last lantern as the sun comes up over Mosslight.', 232, `italic 17px ${FONT_DISPLAY}`, '#f5efdd');
  centerText(ctx, `Final score  ${world.score}`, 300, `700 26px ${FONT}`, '#ffd75e');
  centerText(ctx, `Sunshards ${world.shards} · Time ${fmtTime(world.time)} · Time bonus +${timeBonus}`, 336, `16px ${FONT}`, '#f5efdd');
  centerText(ctx, 'Press Enter or R to play again', 404, `700 19px ${FONT}`, paletteOf(world).accent);
}

export function drawOverScreen(ctx, world) {
  drawWorld(ctx, world);
  dim(ctx, 0.6);
  centerText(ctx, 'The light goes out…', 216, `44px ${FONT_DISPLAY}`, '#e8e4f5');
  centerText(ctx, `Wren reached ${world.def.name} with ${world.shards} sunshards.`, 268, `17px ${FONT}`, '#f5efdd');
  centerText(ctx, `Score ${world.score}`, 302, `700 22px ${FONT}`, '#ffd75e');
  centerText(ctx, 'Press Enter or R to try again', 366, `700 19px ${FONT}`, paletteOf(world).accent);
}