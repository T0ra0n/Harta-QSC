/* Scop: Monitorizează assets/lucrari și regenerează automat assets/locations.json când apar modificări. */

import fs from 'node:fs';
import path from 'node:path';
import { generateLocations } from './generate_locations.mjs';

const projectRoot = process.cwd();
const watchPath = path.join(projectRoot, 'assets', 'lucrari');

let debounceTimer = null;
let isRunning = false;
let pending = false;

async function runGenerate() {
  if (isRunning) {
    pending = true;
    return;
  }

  isRunning = true;
  try {
    await generateLocations();
  } finally {
    isRunning = false;
  }

  if (pending) {
    pending = false;
    await runGenerate();
  }
}

function scheduleGenerate() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    runGenerate().catch((err) => {
      console.error('Eroare la generare (watch):', err);
    });
  }, 250);
}

console.log(`Watch activ pe: ${watchPath}`);
runGenerate().catch((err) => {
  console.error('Eroare la generare inițială:', err);
});

try {
  // Pe macOS, recursive funcționează; dacă pe alt sistem nu funcționează, tot prinde schimbări în folderul principal.
  const watcher = fs.watch(watchPath, { recursive: true }, () => {
    scheduleGenerate();
  });

  process.on('SIGINT', () => {
    watcher.close();
    process.exit(0);
  });
} catch (err) {
  console.error('Nu pot porni watch-ul. În acest caz, folosește: npm run generate', err);
  process.exitCode = 1;
}
