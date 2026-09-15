// scripts/generate-endpoints.js
// Mode B — generate once, then freeze.
// Every subsequent run reuses the existing endpoints.json, so
// service worker registrations and browser caches stay valid
// across redeploys.
//
// Force new aliases: rm server/data/endpoints.json
// Or: FORCE_REGEN=1 npm run gen-endpoints

const fs = require('fs');
const path = require('path');

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
  scramjet: gen('q'), clipmux: gen('m'), wisp1: gen('e'), wisp2: gen('l'),
  rivet: gen('r'), sw: gen('s'),
  uv: gen('u'), staticUv: gen('v'), trojans: gen('t'),
  uvBundle: gen('b'), uvClient: gen('c'), uvConfig: gen('f'), uvHandler: gen('h'), uvSw: gen('w'),
  trojBundle: gen('b'), trojConfig: gen('f'), trojHandler: gen('h'), trojSw: gen('w'), trojRizzSw: gen('r'),
  uvJs: gen('j'), uvSwJs: gen('k'), registerSw: gen('g'),
};

console.log('🔐 Generated endpoints (Mode B — will freeze):');
console.table(E);

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(endpointsPath, JSON.stringify(E, null, 2));

console.log(`\n✅ Written to ${endpointsPath}`);
console.log('   These aliases are now FROZEN — future builds reuse them.');
console.log('   To regenerate: rm server/data/endpoints.json\n');