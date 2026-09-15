// scripts/generate-endpoints.js
// Mode B — generate once, then freeze.
// Every subsequent run reuses the existing endpoints.json, so
// service worker registrations and browser caches stay valid
// across redeploys.
//
// Force new aliases: rm server/data/endpoints.json
// Or: FORCE_REGEN=1 npm run gen-endpoints

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM doesn't have __dirname — build it manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'server', 'data');
const endpointsPath = path.join(dataDir, 'endpoints.json');

// ---- Freeze check ----
if (fs.existsSync(endpointsPath) && !process.env.FORCE_REGEN) {
  console.log('✅ endpoints.json already exists — keeping existing aliases');
  console.log('   Force new: rm server/data/endpoints.json');
  console.log('   Or: FORCE_REGEN=1 npm run gen-endpoints');
  process.exit(0);
}

const gen = (prefix = 'a') => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = prefix;
  for (let i = 0; i < 11; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

const E = {
  // ---- Scramjet folders ----
  scramjet: gen('q'),   // /q9vx/
  clipmux:  gen('m'),   // /m4thx/
  wisp1:    gen('e'),   // /e7px/
  wisp2:    gen('l'),   // /l9cx/
  rivet:    gen('r'),   // /b/rivet/
  sw:       gen('s'),   // 1k123.js

  // ---- UV copies (folders) ----
  uv:       gen('u'),   // /uv/         → server/uv/
  staticUv: gen('v'),   // /static/uv/  → public/static/uv/
  trojans:  gen('t'),   // /trojans/    → public/trojans/

  // ---- UV core files (shared names) ----
  uvBundle:  gen('b'),  // uv.bundle.js
  uvClient:  gen('c'),  // uv.client.js
  uvConfig:  gen('f'),  // uv.config.js
  uvHandler: gen('h'),  // uv.handler.js
  uvSw:      gen('w'),  // uv.sw.js

  // ---- Trojans UV file aliases ----
  trojBundle:  gen('b'), // bundle.js
  trojConfig:  gen('f'), // config.js
  trojHandler: gen('h'), // handler.js
  trojSw:      gen('w'), // sw.js
  trojRizzSw:  gen('r'), // rizz.sw.js

  // ---- Public bootstraps ----
  uvJs:       gen('j'),  // uv.js
  uvSwJs:     gen('k'),  // uv-sw.js
  registerSw: gen('g'),  // register-sw.js
};

console.log('🔐 Generated endpoints (Mode B — will freeze):');
console.table(E);

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(endpointsPath, JSON.stringify(E, null, 2));

console.log(`\n✅ Written to ${endpointsPath}`);
console.log('   These aliases are now FROZEN — future builds reuse them.');
console.log('   To regenerate: rm server/data/endpoints.json\n');