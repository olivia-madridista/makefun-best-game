// Deterministic screenshot staging for the ?shot= modes in shots.json. Each mode builds
// a world from the seed and then plays it with scripted inputs — no teleporting Wren
// into poses the game itself cannot reach, no edited images. main.js renders the staged
// world with the matching screen, so every screenshot is the game's own code, rendered
// in a browser, at a reproducible moment.
//
//   start — the title screen over Dawn Hollow, idled long enough for beetles to patrol.
//   play  — a heuristic driver runs Wren into Dawn Hollow and freezes mid-adventure.
//   win   — the driver finishes Ember Peak from its last lantern; the win screen.
//   end   — a careless driver runs Wren straight into the first pit, three times.

import { TILE, STEP } from './config.js';

export function parseShot(search) {
  const params = new URLSearchParams(search);
  const mode = params.get('shot');
  if (!mode) return null;
  const seed = Number(params.get('seed') ?? 1) || 1;
  return { mode, seed };
}

const IDLE = { left: false, right: false, jumpHeld: false, jumpPressed: false };

// A small heuristic driver: run right, hop walls, spikes and beetles, ride platforms.
// It is the same logic the level tests use to prove each vale can be finished; here it
// only needs to carry Wren a little way into a vale for the camera.
function drive(world, seconds, { careless = false } = {}) {
  const p = world.player;
  let hopLeft = 0;
  const steps = Math.floor(seconds / STEP);
  for (let s = 0; s < steps; s += 1) {
    if (world.levelDone || world.runOver) break;
    const input = { left: false, right: true, jumpHeld: true, jumpPressed: false };
    if (hopLeft > 0) { hopLeft -= 1; if (hopLeft === 0) input.jumpHeld = false; }
    if (!careless) {
      const feetY = p.y + p.h;
      const rightEdge = p.x + p.w;
      const plat = p.standingPlatform;
      const groundAhead = () => world.solidAtPx(rightEdge + 10, feetY + 10);
      const wallAhead = () => world.solidAtPx(rightEdge + 4, p.y + 8) || world.solidAtPx(rightEdge + 4, feetY - 8);
      const spikeAhead = () => {
        for (const dx of [6, 22, 38]) {
          if (world.tileAt(Math.floor((rightEdge + dx) / TILE), Math.floor((feetY - 4) / TILE)) === '^') return true;
        }
        return false;
      };
      const beetleAhead = () => world.beetles.some((b) => b.alive && b.x > p.x && b.x - rightEdge < 56 && Math.abs(b.y - p.y) < 44);
      if (plat) {
        const distToEdge = (plat.px + plat.wPx) - rightEdge;
        const beyondY = plat.axis === 'y' ? plat.py + 40 : plat.py + 80;
        const beyondX = plat.axis === 'y' ? plat.px + plat.wPx + 76 : plat.px + plat.wPx + 18;
        const groundBeyond = world.solidAtPx(beyondX, beyondY);
        const jumpReach = plat.axis === 'x' && world.solidAtPx(plat.px + plat.wPx + 100, plat.py + 80);
        if (jumpReach && distToEdge < 46) input.jumpPressed = true;
        else if (groundBeyond) {
          input.right = true;
          if (plat.axis === 'y' && distToEdge < 34) input.jumpPressed = true;
        } else if (distToEdge < 46) {
          input.right = false;
          input.left = p.vx > 30;
        }
      } else if (p.onGround) {
        if (!groundAhead()) {
          let dropSafe = false;
          for (const dy of [42, 74, 106, 138, 170, 202, 234, 266]) {
            if (world.solidAtPx(rightEdge + 10, feetY + dy)) { dropSafe = true; break; }
          }
          const near = dropSafe ? null : world.platforms.find((pl) => pl.px + pl.wPx > rightEdge && pl.px - rightEdge < 320);
          if (near) {
            const gap = near.px - rightEdge;
            if (near.axis === 'y') {
              if (gap < 150) input.jumpPressed = true;
              else { input.right = false; input.left = p.vx > 30; }
            } else if (gap < 45) { input.jumpPressed = true; hopLeft = 12; }
            else if (gap < 105 && near.dx > 0) input.jumpPressed = true;
            else { input.right = false; input.left = p.vx > 30; }
          } else input.jumpPressed = true;
        } else if (wallAhead() || spikeAhead() || beetleAhead()) input.jumpPressed = true;
      }
    }
    world.step(STEP, input);
  }
}

/** Stage the world for a shot mode; returns the screen main.js should present. */
export function stageShot(world, mode) {
  if (mode === 'play') {
    world.loadLevel(0);
    drive(world, 9.5);
    return 'play';
  }
  if (mode === 'win') {
    world.loadLevel(2);
    // A run that has already crossed two vales: plausible totals, then the driver
    // finishes Ember Peak for real from its final checkpoint lantern.
    world.score = 1150;
    world.shards = 24;
    world.hearts = 2;
    world.time = 236.4;
    const cp = world.checkpoints[world.checkpoints.length - 1];
    if (cp) {
      cp.lit = true;
      world.respawn = { x: cp.x + (32 - world.player.w) / 2, y: cp.y + 32 - world.player.h };
      world.player.x = world.respawn.x;
      world.player.y = world.respawn.y;
      world.updateCamera(1);
    }
    drive(world, 60);
    return 'win';
  }
  if (mode === 'end') {
    world.loadLevel(0);
    drive(world, 40, { careless: true });
    return 'over';
  }
  // 'start' and anything else: an idled title backdrop.
  world.loadLevel(0);
  for (let s = 0; s < 150; s += 1) world.step(STEP, IDLE);
  return 'title';
}
