// Mosslight's shell: the loop, the screens, the sound. The world (world.js) simulates,
// the renderer (render.js) paints, and this module decides which screen the player is
// on and feeds inputs and event sounds between them. It also serves the deterministic
// ?shot= screenshot modes: stage a world, paint one frame, raise the ready flag.

import {
  VIEW_WIDTH, VIEW_HEIGHT, STEP, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_CLEAR,
  SCREEN_WIN, SCREEN_OVER, SCORE_LEVEL_CLEAR, SCORE_TIME_BONUS_PER_SECOND, PAR_SECONDS,
  START_HEARTS,
} from './config.js';
import { World } from './world.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import {
  drawWorld, drawHUD, drawTitleScreen, drawPauseScreen, drawClearScreen, drawWinScreen,
  drawOverScreen,
} from './render.js';
import { parseShot, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

/** Paint with the 960x540 view scaled to fill the window, letterboxed, centred. */
function paint(draw) {
  const scale = Math.min(canvas.width / VIEW_WIDTH, canvas.height / VIEW_HEIGHT);
  const ox = (canvas.width - VIEW_WIDTH * scale) / 2;
  const oy = (canvas.height - VIEW_HEIGHT * scale) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#14101f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  ctx.beginPath();
  ctx.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.clip();
  draw();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

const shot = parseShot(window.location.search);
const input = new Input(canvas);
const sound = new SoundBank();
let muted = false;

let screen = SCREEN_TITLE;
let world = new World(shot?.seed ?? 1);
let backdrop = new World(shot?.seed ?? 1); // idles behind the title screen
let timeBonus = 0;
let clearTimer = 0;

const EVENT_SOUNDS = {
  jump: () => sound.jump(),
  shard: () => sound.shard(),
  stomp: () => sound.stomp(),
  hurt: () => sound.hurt(),
  pit: () => sound.hurt(),
  spring: () => sound.spring(),
  checkpoint: () => sound.checkpoint(),
};

function announce(text) {
  if (status) status.textContent = text;
}

function startRun() {
  world = new World(shot?.seed ?? 1);
  world.resetRun();
  timeBonus = 0;
  screen = SCREEN_PLAY;
  announce(`Vale I: ${world.def.name}. Relight the Great Lantern.`);
}

function onGoal() {
  world.score += SCORE_LEVEL_CLEAR;
  if (world.levelIndex >= 2) {
    timeBonus = Math.max(0, Math.floor(PAR_SECONDS - world.time)) * SCORE_TIME_BONUS_PER_SECOND;
    world.score += timeBonus;
    world.won = true;
    screen = SCREEN_WIN;
    sound.win();
    announce(`You win. Final score ${world.score}.`);
  } else {
    screen = SCREEN_CLEAR;
    clearTimer = 0;
    sound.goal();
    announce(`${world.def.name} relit. Press Enter for the next vale.`);
  }
}

function nextVale() {
  const hearts = Math.min(START_HEARTS, world.hearts + 1); // a relit vale restores a heart
  const { score, shards, time } = world;
  world.loadLevel(world.levelIndex + 1);
  world.hearts = hearts;
  world.score = score;
  world.shards = shards;
  world.time = time;
  screen = SCREEN_PLAY;
  announce(`Vale ${world.levelIndex + 1}: ${world.def.name}.`);
}

function stepWorld(frameDt) {
  // One jump edge a frame, offered to the first step; the world's buffer does the rest.
  let jumpEdge = input.takeJumpPress();
  const move = input.moveState();
  let remaining = frameDt;
  while (remaining > 0) {
    const dt = Math.min(STEP, remaining);
    remaining -= dt;
    const events = world.step(dt, {
      left: move.left, right: move.right, jumpHeld: move.jumpHeld, jumpPressed: jumpEdge,
    });
    jumpEdge = false;
    for (const event of events) {
      if (event === 'goal') onGoal();
      else if (event === 'over') {
        screen = SCREEN_OVER;
        sound.over();
        announce('Game over. Press Enter to try again.');
      } else if (EVENT_SOUNDS[event]) EVENT_SOUNDS[event]();
    }
    if (screen !== SCREEN_PLAY) break;
  }
}

function drawScreen() {
  paint(() => {
    if (screen === SCREEN_TITLE) drawTitleScreen(ctx, backdrop);
    else if (screen === SCREEN_PLAY) { drawWorld(ctx, world); drawHUD(ctx, world, muted); }
    else if (screen === SCREEN_PAUSE) { drawPauseScreen(ctx, world); drawHUD(ctx, world, muted); }
    else if (screen === SCREEN_CLEAR) drawClearScreen(ctx, world);
    else if (screen === SCREEN_WIN) drawWinScreen(ctx, world, timeBonus);
    else if (screen === SCREEN_OVER) drawOverScreen(ctx, world);
  });
}

if (shot) {
  // Screenshot mode: stage, paint, and hold still for the camera.
  const staged = stageShot(world, shot.mode);
  if (shot.mode === 'win') {
    timeBonus = Math.max(0, Math.floor(PAR_SECONDS - world.time)) * SCORE_TIME_BONUS_PER_SECOND;
    world.score += SCORE_LEVEL_CLEAR + timeBonus;
    world.won = true;
  }
  screen = staged === 'title' ? SCREEN_TITLE : staged === 'play' ? SCREEN_PLAY
    : staged === 'win' ? SCREEN_WIN : SCREEN_OVER;
  if (screen === SCREEN_TITLE) backdrop = world;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    drawScreen();
    window.__shotReady = true;
    document.body.dataset.shot = shot.mode;
  }));
} else {
  let last = performance.now();
  let backdropAcc = 0;
  function frame(now) {
    const frameDt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (input.anyGesture) sound.unlock();

    if (input.takeEdge('mute')) {
      muted = !muted;
      sound.setMuted(muted);
    }

    if (screen === SCREEN_TITLE) {
      backdropAcc += frameDt;
      while (backdropAcc > STEP) {
        backdrop.step(STEP, { left: false, right: false, jumpHeld: false, jumpPressed: false });
        backdropAcc -= STEP;
      }
      if (backdrop.levelDone || backdrop.runOver) backdrop = new World(1);
      if (input.takeEdge('confirm') || input.takeEdge('click')) startRun();
    } else if (screen === SCREEN_PLAY) {
      if (input.takeEdge('pause')) screen = SCREEN_PAUSE;
      else stepWorld(frameDt);
    } else if (screen === SCREEN_PAUSE) {
      if (input.takeEdge('pause') || input.takeEdge('confirm')) screen = SCREEN_PLAY;
      else if (input.takeEdge('restart')) startRun();
    } else if (screen === SCREEN_CLEAR) {
      clearTimer += frameDt;
      if (clearTimer > 0.4 && (input.takeEdge('confirm') || input.takeEdge('click'))) nextVale();
    } else if (screen === SCREEN_WIN || screen === SCREEN_OVER) {
      if (input.takeEdge('confirm') || input.takeEdge('restart') || input.takeEdge('click')) startRun();
    }

    sound.updateMusic(frameDt, screen === SCREEN_PLAY);
    drawScreen();
    requestAnimationFrame(frame);
  }
  announce('Mosslight. Press Enter to begin.');
  requestAnimationFrame(frame);
}
