// scripts/generate-endpoints.js
const fs = require('fs');
const path = require('path');

// ---- Random name generator (looks like a CDN hash) ----
const gen = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

const ENDPOINTS = {
  scramjet:    gen(),
  ultraviolet: gen(),
  alloy:       gen(),
  titanium:    gen(),
  libcurl:     gen(),
  google:      gen(),
  youtube:     gen(),
  tor:         gen(),
  wisp:        gen(),
  bare:        gen(),
  sw:          gen(),
};

console.log('🔐 Generated endpoints:');
console.log(ENDPOINTS);

// ---- Write endpoints.json ----
const dataDir = path.join(__dirname, '..', 'server', 'data');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(
  path.join(dataDir, 'endpoints.json'),
  JSON.stringify(ENDPOINTS, null, 2)
);

// ---- Rewrite references in bundled proxy files ----
const REPLACEMENTS = [
  ['/scramjet/service/', `/${ENDPOINTS.scramjet}/service/`],
  ['/scramjet/sw.js',    `/${ENDPOINTS.scramjet}/${ENDPOINTS.sw}.js`],
  ['/scramjet/',         `/${ENDPOINTS.scramjet}/`],
  ['/uv/service/',       `/${ENDPOINTS.ultraviolet}/service/`],
  ['/uv-sw.js',          `/${ENDPOINTS.ultraviolet}-sw.js`],
  ['/uv/',               `/${ENDPOINTS.ultraviolet}/`],
  ['/alloy/service/',    `/${ENDPOINTS.alloy}/service/`],
  ['/alloy/',            `/${ENDPOINTS.alloy}/`],
  ['/titanium/service/', `/${ENDPOINTS.titanium}/service/`],
  ['/titanium/',         `/${ENDPOINTS.titanium}/`],
  ['/libcurl',           `/${ENDPOINTS.libcurl}`],
  ['/wisp/',             `/${ENDPOINTS.wisp}/`],
  ['/bare/',             `/${ENDPOINTS.bare}/`],
  ['/register-sw.js',    `/${ENDPOINTS.sw}-register.js`],
  ['/sw.js',             `/${ENDPOINTS.sw}.js`],
];

const replaceInFile = (filePath) => {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }
  let changed = false;
  for (const [from, to] of REPLACEMENTS) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✏️  Rewrote: ${path.relative(process.cwd(), filePath)}`);
  }
};

const walk = (dir, cb) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p, cb);
    else cb(p);
  }
};

const TARGET_DIRS = [
  path.join(__dirname, '..', 'public'),
  path.join(__dirname, '..', 'server', 'modules'),
];

console.log('\n📝 Rewriting references in bundled files...');
for (const dir of TARGET_DIRS) {
  walk(dir, (file) => {
    if (/\.(js|html|json|map|wasm)$/.test(file)) replaceInFile(file);
  });
}

console.log('\n✅ Endpoint generation complete.\n');
