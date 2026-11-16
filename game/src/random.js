// A tiny seeded random number generator (mulberry32). The game's sparkles, beetle phases and
// background details all draw from one of these, so a seed always grows the same vale — the
// screenshot scenes rely on that to render the same frame every time.

export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 0..1 value for a pair of tile coordinates, so decoration never flickers or drifts. */
export function tileHash(tx, ty) {
  let h = (tx * 374761393 + ty * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
