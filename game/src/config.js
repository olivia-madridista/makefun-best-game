// Mosslight tuning: the view, the physics and the scoring every other module shares.
// Distances are pixels, times are seconds, speeds are pixels a second.

export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;
export const TILE = 32;

export const STEP = 1 / 120; // fixed physics step; rendering interpolates nothing, it just draws

export const GRAVITY = 2300;
export const MAX_FALL_SPEED = 920;
export const RUN_SPEED = 268;
export const GROUND_ACCEL = 2800;
export const AIR_ACCEL = 1900;
export const GROUND_FRICTION = 2600;
export const JUMP_SPEED = 824; // leaves the ground fast enough to clear a four-tile rise
export const JUMP_CUT_SPEED = 300; // letting go of jump clamps the rise to this, for short hops
export const COYOTE_TIME = 0.09; // grace to still jump just after walking off a ledge
export const JUMP_BUFFER = 0.12; // a jump pressed just before landing still counts
export const SPRING_SPEED = 1090; // bounce pads throw Wren higher than any jump

export const PLAYER_WIDTH = 22;
export const PLAYER_HEIGHT = 30;
export const START_HEARTS = 3;
export const HURT_KNOCKBACK_X = 240;
export const HURT_KNOCKBACK_Y = 330;
export const INVINCIBLE_TIME = 1.4; // seconds of mercy blinking after a hit

export const SCORE_SHARD = 50;
export const SCORE_STOMP = 100;
export const SCORE_CHECKPOINT = 25;
export const SCORE_LEVEL_CLEAR = 250;
export const SCORE_TIME_BONUS_PER_SECOND = 5; // at the win: this per second left on the par
export const PAR_SECONDS = 420; // finish all three vales inside this for any time bonus

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

// One palette a vale: sky gradient, far and near hill silhouettes, earth and moss, and the
// accent the lanterns and sunshards glow with. Render reads these, never hard-coded colours.
export const PALETTES = [
  {
    name: 'dawn',
    skyTop: '#2e4a7a', skyMid: '#c96f4a', skyLow: '#f7c873',
    sun: '#ffe9a8', hillsFar: '#4a5d8a', hillsNear: '#2f4a4e',
    earth: '#5d4037', earthDark: '#46302a', moss: '#7fae4c', mossDark: '#5d8a38',
    stone: '#8d8fa3', stoneDark: '#6b6d82', accent: '#ffd75e',
  },
  {
    name: 'dusk',
    skyTop: '#1d1440', skyMid: '#6e3a7d', skyLow: '#e2703a',
    sun: '#ffb37a', hillsFar: '#3a2a5e', hillsNear: '#241f42',
    earth: '#4a3244', earthDark: '#372536', moss: '#5f9e6e', mossDark: '#477c53',
    stone: '#7a7591', stoneDark: '#5b5670', accent: '#ffc94d',
  },
  {
    name: 'night',
    skyTop: '#070d24', skyMid: '#16264f', skyLow: '#3a5a8a',
    sun: '#e8f1ff', hillsFar: '#1c2c50', hillsNear: '#101c38',
    earth: '#3a3049', earthDark: '#2b2338', moss: '#4c8a6b', mossDark: '#386650',
    stone: '#6e7590', stoneDark: '#525a73', accent: '#ffe98a',
  },
];
