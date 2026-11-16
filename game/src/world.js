// The world: tiles, physics and every living thing in a vale. This module never touches the
// DOM — main.js feeds it input states and draws what it holds — so the same step the browser
// plays can be driven headlessly to prove a vale can be finished.
//
// step(dt, input) advances one fixed step; input is { left, right, jumpHeld, jumpPressed }.
// Everything the player should hear or feel is reported as event names in world.events
// ('jump', 'shard', 'stomp', 'hurt', 'spring', 'checkpoint', 'goal', 'pit', 'over').

import {
  TILE, GRAVITY, MAX_FALL_SPEED, RUN_SPEED, GROUND_ACCEL, AIR_ACCEL, GROUND_FRICTION,
  JUMP_SPEED, JUMP_CUT_SPEED, COYOTE_TIME, JUMP_BUFFER, SPRING_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT, START_HEARTS, HURT_KNOCKBACK_X, HURT_KNOCKBACK_Y,
  INVINCIBLE_TIME, SCORE_SHARD, SCORE_STOMP, SCORE_CHECKPOINT, VIEW_WIDTH,
} from './config.js';
import { LEVELS } from './levels.js';
import { makeRng, tileHash } from './random.js';

const BEETLE_WIDTH = 26;
const BEETLE_HEIGHT = 20;
const BEETLE_SPEED = 55;
const LEVEL_HEIGHT = 17;

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class World {
  constructor(seed = 1) {
    this.rng = makeRng(seed);
    this.events = [];
    this.particles = [];
    this.resetRun();
  }

  resetRun() {
    this.hearts = START_HEARTS;
    this.score = 0;
    this.shards = 0;
    this.time = 0;
    this.levelIndex = 0;
    this.runOver = false;
    this.won = false;
    this.loadLevel(0);
  }

  loadLevel(index) {
    const def = LEVELS[index];
    this.levelIndex = index;
    this.def = def;
    this.levelTime = 0;
    this.levelDone = false;
    this.grid = [];
    for (let r = 0; r < LEVEL_HEIGHT; r += 1) {
      this.grid.push((def.rows[r] ?? '').padEnd(def.width, '.'));
    }
    this.shardList = [];
    this.checkpoints = [];
    this.beetles = [];
    this.springs = [];
    this.goal = null;
    this.start = { x: TILE, y: TILE };
    for (let ty = 0; ty < LEVEL_HEIGHT; ty += 1) {
      for (let tx = 0; tx < def.width; tx += 1) {
        const ch = this.grid[ty][tx];
        const px = tx * TILE;
        const py = ty * TILE;
        if (ch === 'P') this.start = { x: px + (TILE - PLAYER_WIDTH) / 2, y: py + TILE - PLAYER_HEIGHT };
        else if (ch === 'o') this.shardList.push({ x: px + TILE / 2, y: py + TILE / 2, taken: false, phase: tileHash(tx, ty) * 6.28 });
        else if (ch === 'C') this.checkpoints.push({ x: px, y: py, lit: false });
        else if (ch === 'G') this.goal = { x: px, y: py };
        else if (ch === 'E') this.beetles.push({
          x: px + (TILE - BEETLE_WIDTH) / 2, y: py + TILE - BEETLE_HEIGHT,
          w: BEETLE_WIDTH, h: BEETLE_HEIGHT, vx: 0, vy: 0,
          dir: tileHash(tx, ty) > 0.5 ? 1 : -1, alive: true, onGround: false, animPhase: tileHash(ty, tx) * 6.28,
        });
        else if (ch === 'S') this.springs.push({ x: px, y: py, squash: 0 });
      }
    }
    this.levelShardCount = this.shardList.length;
    this.shardsThisLevel = 0;
    this.platforms = (def.platforms ?? []).map((p) => ({
      ...p, px: p.x * TILE, py: p.y * TILE, dx: 0, dy: 0, wPx: p.w * TILE, hPx: 16,
    }));
    this.respawn = { ...this.start };
    this.player = {
      x: this.start.x, y: this.start.y, w: PLAYER_WIDTH, h: PLAYER_HEIGHT,
      vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, buffer: 0,
      invincible: 0, animTime: 0, standingPlatform: null, dead: false,
    };
    this.camera = { x: 0, y: 4 };
    this.updateCamera(1);
  }

  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.def.width || ty < 0) return '.';
    if (ty >= LEVEL_HEIGHT) return '.';
    return this.grid[ty][tx];
  }

  isSolid(tx, ty) {
    const ch = this.tileAt(tx, ty);
    return ch === '#' || ch === 'X';
  }

  solidAtPx(px, py) {
    return this.isSolid(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  burst(x, y, kind, count, speed = 160) {
    for (let i = 0; i < count; i += 1) {
      const angle = this.rng() * Math.PI * 2;
      const v = speed * (0.3 + this.rng() * 0.7);
      this.particles.push({
        x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 60,
        life: 0, maxLife: 0.35 + this.rng() * 0.4, size: 2 + this.rng() * 3, kind,
      });
    }
  }

  hurt(sourceX) {
    const p = this.player;
    if (p.invincible > 0 || this.levelDone || this.runOver) return;
    this.hearts -= 1;
    this.events.push('hurt');
    this.burst(p.x + p.w / 2, p.y + p.h / 2, 'poof', 10, 130);
    if (this.hearts <= 0) {
      this.runOver = true;
      this.events.push('over');
      return;
    }
    p.vx = (p.x + p.w / 2 < sourceX ? -1 : 1) * HURT_KNOCKBACK_X;
    p.vy = -HURT_KNOCKBACK_Y;
    p.invincible = INVINCIBLE_TIME;
    p.onGround = false;
  }

  respawnAtCheckpoint() {
    const p = this.player;
    p.x = this.respawn.x;
    p.y = this.respawn.y;
    p.vx = 0;
    p.vy = 0;
    p.invincible = 1.0;
    p.standingPlatform = null;
    this.updateCamera(1);
  }

  platformPose(p, t) {
    const cycle = (t * p.speed) / p.range + p.phase;
    const u = ((cycle % 2) + 2) % 2;
    const tri = u < 1 ? u : 2 - u;
    const off = tri * p.range * TILE;
    return {
      x: p.x * TILE + (p.axis === 'x' ? off : 0),
      y: p.y * TILE + (p.axis === 'y' ? off : 0),
    };
  }

  step(dt, input) {
    this.events.length = 0;
    if (this.runOver || this.levelDone) return this.events;
    this.time += dt;
    this.levelTime += dt;
    const p = this.player;

    // Moving platforms first: where they are now, and how far they moved this step.
    for (const plat of this.platforms) {
      const pose = this.platformPose(plat, this.levelTime);
      plat.dx = pose.x - plat.px;
      plat.dy = pose.y - plat.py;
      plat.px = pose.x;
      plat.py = pose.y;
    }
    if (p.standingPlatform) {
      p.x += p.standingPlatform.dx;
      p.y += p.standingPlatform.dy;
    }

    // Horizontal intent: accelerate toward the run speed, or bleed speed off on the ground.
    const accel = p.onGround ? GROUND_ACCEL : AIR_ACCEL;
    if (input.left && !input.right) {
      p.vx = Math.max(-RUN_SPEED, p.vx - accel * dt);
      p.face = -1;
    } else if (input.right && !input.left) {
      p.vx = Math.min(RUN_SPEED, p.vx + accel * dt);
      p.face = 1;
    } else if (p.onGround) {
      const sign = Math.sign(p.vx);
      p.vx -= sign * Math.min(Math.abs(p.vx), GROUND_FRICTION * dt);
    }

    // Jumping: a buffered press, spent on the ground or in the coyote grace after a ledge.
    if (input.jumpPressed) p.buffer = JUMP_BUFFER;
    else p.buffer = Math.max(0, p.buffer - dt);
    p.coyote = p.onGround ? COYOTE_TIME : Math.max(0, p.coyote - dt);
    if (p.buffer > 0 && (p.onGround || p.coyote > 0)) {
      p.vy = -JUMP_SPEED;
      p.buffer = 0;
      p.coyote = 0;
      p.onGround = false;
      p.standingPlatform = null;
      this.events.push('jump');
      this.burst(p.x + p.w / 2, p.y + p.h, 'dust', 5, 70);
    }
    p.vy = Math.min(MAX_FALL_SPEED, p.vy + GRAVITY * dt);
    if (!input.jumpHeld && p.vy < -JUMP_CUT_SPEED) p.vy = -JUMP_CUT_SPEED;

    this.moveX(p, dt);
    this.moveY(p, dt, true);
    if (p.invincible > 0) p.invincible = Math.max(0, p.invincible - dt);
    p.animTime += dt * (Math.abs(p.vx) > 20 && p.onGround ? 1.6 : 1);

    this.jumpHeldNow = input.jumpHeld;
    this.stepBeetles(dt);
    this.stepInteractions(dt);
    this.stepParticles(dt);
    this.updateCamera(dt);
    return this.events;
  }

  moveX(body, dt) {
    body.x += body.vx * dt;
    const top = Math.floor(body.y / TILE);
    const bottom = Math.floor((body.y + body.h - 1) / TILE);
    if (body.vx > 0) {
      const tx = Math.floor((body.x + body.w) / TILE);
      for (let ty = top; ty <= bottom; ty += 1) {
        if (this.isSolid(tx, ty)) { body.x = tx * TILE - body.w - 0.01; body.vx = 0; break; }
      }
    } else if (body.vx < 0) {
      const tx = Math.floor(body.x / TILE);
      for (let ty = top; ty <= bottom; ty += 1) {
        if (this.isSolid(tx, ty)) { body.x = (tx + 1) * TILE + 0.01; body.vx = 0; break; }
      }
    }
    if (body.x < 0) { body.x = 0; body.vx = 0; }
    const maxX = this.def.width * TILE - body.w;
    if (body.x > maxX) { body.x = maxX; body.vx = 0; }
  }

  moveY(body, dt, isPlayer = false) {
    const prevBottom = body.y + body.h;
    body.y += body.vy * dt;
    body.onGround = false;
    const left = Math.floor(body.x / TILE);
    const right = Math.floor((body.x + body.w - 1) / TILE);
    if (body.vy >= 0) {
      const ty = Math.floor((body.y + body.h) / TILE);
      for (let tx = left; tx <= right; tx += 1) {
        if (this.isSolid(tx, ty)) {
          body.y = ty * TILE - body.h;
          body.vy = 0;
          body.onGround = true;
          if (isPlayer) body.standingPlatform = null;
          break;
        }
      }
      // One-way tops of the moving platforms: land only when falling onto them.
      if (!body.onGround && isPlayer) {
        for (const plat of this.platforms) {
          const platBox = { x: plat.px, y: plat.py, w: plat.wPx, h: plat.hPx };
          if (body.x + body.w > platBox.x + 2 && body.x < platBox.x + platBox.w - 2
            && prevBottom <= platBox.y + 8 && body.y + body.h >= platBox.y) {
            body.y = platBox.y - body.h;
            body.vy = 0;
            body.onGround = true;
            body.standingPlatform = plat;
            break;
          }
        }
      }
    } else {
      const ty = Math.floor(body.y / TILE);
      for (let tx = left; tx <= right; tx += 1) {
        if (this.isSolid(tx, ty)) { body.y = (ty + 1) * TILE; body.vy = 0; break; }
      }
    }
    if (!body.onGround && isPlayer) body.standingPlatform = null;
  }

  stepBeetles(dt) {
    for (const b of this.beetles) {
      if (!b.alive) continue;
      b.animPhase += dt * 6;
      // Walk, turning at walls and at the edge of whatever ground it patrols.
      const frontX = b.dir > 0 ? b.x + b.w + 2 : b.x - 2;
      const midY = b.y + b.h / 2;
      const wallAhead = this.solidAtPx(frontX, midY);
      const groundAhead = this.solidAtPx(frontX, b.y + b.h + 6);
      if (b.onGround && (wallAhead || !groundAhead)) b.dir *= -1;
      b.vx = b.dir * BEETLE_SPEED;
      b.x += b.vx * dt;
      // Keep the beetle out of walls it walked into while airborne or turning.
      const top = Math.floor(b.y / TILE);
      const bottom = Math.floor((b.y + b.h - 1) / TILE);
      if (b.vx > 0) {
        const tx = Math.floor((b.x + b.w) / TILE);
        for (let ty = top; ty <= bottom; ty += 1) if (this.isSolid(tx, ty)) { b.x = tx * TILE - b.w - 0.01; break; }
      } else if (b.vx < 0) {
        const tx = Math.floor(b.x / TILE);
        for (let ty = top; ty <= bottom; ty += 1) if (this.isSolid(tx, ty)) { b.x = (tx + 1) * TILE + 0.01; break; }
      }
      b.vy = Math.min(MAX_FALL_SPEED, b.vy + GRAVITY * dt);
      this.moveY(b, dt);
    }
  }

  stepInteractions(dt) {
    const p = this.player;
    const pBox = { x: p.x, y: p.y, w: p.w, h: p.h };

    // A pit swallows Wren whole: a heart, and back to the last lit lantern.
    if (p.y > LEVEL_HEIGHT * TILE + 30) {
      this.hearts -= 1;
      this.events.push('pit');
      this.burst(p.x + p.w / 2, LEVEL_HEIGHT * TILE - 10, 'poof', 8, 100);
      if (this.hearts <= 0) {
        this.runOver = true;
        this.events.push('over');
      } else {
        this.respawnAtCheckpoint();
      }
      return;
    }

    for (const s of this.springs) {
      if (s.squash > 0) s.squash = Math.max(0, s.squash - dt * 4);
      const zone = { x: s.x + 3, y: s.y + TILE - 14, w: TILE - 6, h: 14 };
      if (p.vy >= 0 && overlaps(pBox, zone)) {
        p.vy = -SPRING_SPEED;
        p.onGround = false;
        p.standingPlatform = null;
        s.squash = 1;
        this.events.push('spring');
        this.burst(p.x + p.w / 2, s.y + TILE, 'dust', 6, 80);
      }
    }

    for (const shard of this.shardList) {
      if (shard.taken) continue;
      const bob = Math.sin(this.levelTime * 2.4 + shard.phase) * 3;
      const box = { x: shard.x - 10, y: shard.y - 10 + bob, w: 20, h: 20 };
      if (overlaps(pBox, box)) {
        shard.taken = true;
        this.shards += 1;
        this.shardsThisLevel += 1;
        this.score += SCORE_SHARD;
        this.events.push('shard');
        this.burst(shard.x, shard.y, 'spark', 8, 120);
      }
    }

    for (const cp of this.checkpoints) {
      const box = { x: cp.x - 4, y: cp.y - TILE, w: TILE + 8, h: TILE * 2 };
      if (overlaps(pBox, box)) {
        this.respawn = { x: cp.x + (TILE - PLAYER_WIDTH) / 2, y: cp.y + TILE - PLAYER_HEIGHT };
        if (!cp.lit) {
          cp.lit = true;
          this.score += SCORE_CHECKPOINT;
          this.events.push('checkpoint');
          this.burst(cp.x + TILE / 2, cp.y, 'spark', 12, 130);
        }
      }
    }

    if (this.goal) {
      const box = { x: this.goal.x - 6, y: this.goal.y - TILE, w: TILE + 12, h: TILE * 2 };
      if (overlaps(pBox, box)) {
        this.levelDone = true;
        this.events.push('goal');
        this.burst(this.goal.x + TILE / 2, this.goal.y, 'spark', 22, 190);
      }
    }

    // Thorns bite anything that touches them, Wren included.
    const pLeft = Math.floor(p.x / TILE);
    const pRight = Math.floor((p.x + p.w - 1) / TILE);
    const pTop = Math.floor(p.y / TILE);
    const pBottom = Math.floor((p.y + p.h - 1) / TILE);
    for (let ty = pTop; ty <= pBottom; ty += 1) {
      for (let tx = pLeft; tx <= pRight; tx += 1) {
        if (this.tileAt(tx, ty) !== '^') continue;
        const thorn = { x: tx * TILE + 5, y: ty * TILE + 18, w: TILE - 10, h: 14 };
        if (overlaps(pBox, thorn)) this.hurt(tx * TILE + TILE / 2);
      }
    }

    for (const b of this.beetles) {
      if (!b.alive) continue;
      if (!overlaps(pBox, b)) continue;
      const stomp = p.vy > 40 && (p.y + p.h) - b.y < 16;
      if (stomp) {
        b.alive = false;
        this.score += SCORE_STOMP;
        p.vy = this.jumpHeldNow ? -700 : -500; // a held jump bounces higher off a stomp
        this.events.push('stomp');
        this.burst(b.x + b.w / 2, b.y + b.h / 2, 'poof', 12, 150);
      } else {
        this.hurt(b.x + b.w / 2);
      }
    }
  }

  stepParticles(dt) {
    for (const pt of this.particles) {
      pt.life += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 300 * dt;
    }
    this.particles = this.particles.filter((pt) => pt.life < pt.maxLife);
  }

  updateCamera(dt) {
    const p = this.player;
    const target = p.x + p.w / 2 - VIEW_WIDTH / 2;
    const maxCam = Math.max(0, this.def.width * TILE - VIEW_WIDTH);
    const clamped = Math.min(maxCam, Math.max(0, target));
    const blend = dt >= 1 ? 1 : Math.min(1, dt * 8);
    this.camera.x += (clamped - this.camera.x) * blend;
  }
}
