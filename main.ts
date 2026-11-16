// Mosslight — entry program for make.fun's best-game-01 bounty (Node 22, standard library only).
//
// The game itself is the static site in game/: plain files a desktop browser loads offline, no
// build step and no network. This program is the hand-in: it copies game/ and screenshots/ from
// beside this file into the output directory and writes dossier.json there with buildDossier
// from the vendored make.fun library, so the grader sees exactly the files the judge will read.
//
// Run it the way the grader does:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader's container.)
// Play the game locally with: node serve.ts  →  http://localhost:8080

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The whole game tree, copied as-is: the gate re-checks every file it finds here.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

// Screenshots ride along in their own folder; the first by name is the cover.
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier is regenerated from the copied files, never hand-written: the gate rebuilds it
// with the same library and compares byte for byte. The caps below are the scorer's own, so an
// entry that would be refused (too many or too heavy files, an oversize screenshot) fails here
// first instead of at grading.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
