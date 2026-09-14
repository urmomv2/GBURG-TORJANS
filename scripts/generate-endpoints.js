// scripts/generate-endpoints.js
const fs = require('fs');
const path = require('path');

const gen = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

const E = {
  // ---- Folder IDs ----
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

  // ---- Ultraviolet core files ----
  uvBundle:    gen(),
  uvClient:    gen(),
  uvConfig:    gen(),
  uvHandler:   gen(),
  uvSw:        gen(),

  // ---- Scramjet core files (modules/) ----
  scramBundle: gen(),
  scramSync:   gen(),
  scramWasm:   gen(),
  scramAll:    gen(),
  sjBundle:    gen(),
  sjSync:      gen(),
  sjWasm:      gen(),
  sjAll:       gen(),
  startAll:    gen(),

  // ---- Scramjet (res/scram/) ----
  resMain:     gen(),
  resSync:     gen(),
  resBin:      gen(),

  // ---- Scramjet (kernel/scram/) ----
  kernelAll:    gen(),
  kernelBundle: gen(),
  kernelSync:   gen(),
  kernelWasm:   gen(),

  // ---- Public wrapper files ----
  uvJs:              gen(),
  uvSwJs:            gen(),
  scramEmbed:        gen(),
  youtubeEmbed:      gen(),
  youtubeRegisterSw: gen(),
  ytRegisterSw:      gen(),
  googleEmbed:       gen(),
  googleConfig:      gen(),
  libcurlEmbed:      gen(),
  embedHtml:         gen(),
  embedJs:           gen(),
  loaderJs:          gen(),
  pageJs:            gen(),
  searchJs:          gen(),
  indexJs:           gen(),
  registerSw:        gen(),
  swJs:              gen(),
};

console.log('🔐 Generated endpoints:');
console.log(E);

// ---- Write endpoints.json ----
const dataDir = path.join(__dirname, '..', 'server', 'data');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(
  path.join(dataDir, 'endpoints.json'),
  JSON.stringify(E, null, 2)
);

// ---- Rewrite references in bundled proxy files ----
// Ordered LONGEST first to avoid partial-match corruption.
const REPLACEMENTS = [
  // ---------- UV core ----------
  ['/uv/uv.bundle.js',  `/${E.ultraviolet}/${E.uvBundle}.js`],
  ['/uv/uv.client.js',  `/${E.ultraviolet}/${E.uvClient}.js`],
  ['/uv/uv.config.js',  `/${E.ultraviolet}/${E.uvConfig}.js`],
  ['/uv/uv.handler.js', `/${E.ultraviolet}/${E.uvHandler}.js`],
  ['/uv/uv.sw.js',      `/${E.ultraviolet}/${E.uvSw}.js`],
  ['/uv-sw.js',         `/${E.uvSwJs}.js`],
  ['/uv.js',            `/${E.uvJs}.js`],
  ['/uv/',              `/${E.ultraviolet}/`],
  ['uv.bundle.js',      `${E.uvBundle}.js`],
  ['uv.client.js',      `${E.uvClient}.js`],
  ['uv.config.js',      `${E.uvConfig}.js`],
  ['uv.handler.js',     `${E.uvHandler}.js`],
  ['uv.sw.js',          `${E.uvSw}.js`],

  // ---------- Scramjet core ----------
  ['/scramjet/scramjet.bundle.js', `/${E.scramjet}/${E.scramBundle}.js`],
  ['/scramjet/scramjet.sync.js',   `/${E.scramjet}/${E.scramSync}.js`],
  ['/scramjet/scramjet.wasm.wasm', `/${E.scramjet}/${E.scramWasm}.wasm`],
  ['/scramjet/scramjet.all.js',    `/${E.scramjet}/${E.scramAll}.js`],
  ['/scramjet/sj.bundle.js',       `/${E.scramjet}/${E.sjBundle}.js`],
  ['/scramjet/sj.sync.js',         `/${E.scramjet}/${E.sjSync}.js`],
  ['/scramjet/sj.wasm.wasm',       `/${E.scramjet}/${E.sjWasm}.wasm`],
  ['/scramjet/sj.all.js',          `/${E.scramjet}/${E.sjAll}.js`],
  ['/scramjet/start.all.js',       `/${E.scramjet}/${E.startAll}.js`],
  ['/scramjet/',                   `/${E.scramjet}/`],
  ['scramjet.bundle.js',           `${E.scramBundle}.js`],
  ['scramjet.sync.js',             `${E.scramSync}.js`],
  ['scramjet.wasm.wasm',           `${E.scramWasm}.wasm`],
  ['scramjet.all.js',              `${E.scramAll}.js`],
  ['sj.bundle.js',                 `${E.sjBundle}.js`],
  ['sj.sync.js',                   `${E.sjSync}.js`],
  ['sj.wasm.wasm',                 `${E.sjWasm}.wasm`],
  ['sj.all.js',                    `${E.sjAll}.js`],
  ['start.all.js',                 `${E.startAll}.js`],

  // ---------- Public wrapper files ----------
  ['/scram-embed.html',       `/${E.scramEmbed}.html`],
  ['/youtube-embed.html',     `/${E.youtubeEmbed}.html`],
  ['/youtube-register-sw.js', `/${E.youtubeRegisterSw}.js`],
  ['/yt-register-sw.js',      `/${E.ytRegisterSw}.js`],
  ['/google-embed.html',      `/${E.googleEmbed}.html`],
  ['/google-config.js',       `/${E.googleConfig}.js`],
  ['/libcurl-embed.html',     `/${E.libcurlEmbed}.html`],
  ['/embed.html',             `/${E.embedHtml}.html`],
  ['/embed.js',               `/${E.embedJs}.js`],
  ['/loader.js',              `/${E.loaderJs}.js`],
  ['/page.js',                `/${E.pageJs}.js`],
  ['/search.js',              `/${E.searchJs}.js`],
  ['/register-sw.js',         `/${E.registerSw}.js`],
  ['/index.js',               `/${E.indexJs}.js`],
  ['/sw.js',                  `/${E.swJs}.js`],

  // ---------- Folder IDs ----------
  ['/alloy/service/',    `/${E.alloy}/service/`],
  ['/alloy/',            `/${E.alloy}/`],
  ['/titanium/service/', `/${E.titanium}/service/`],
  ['/titanium/',         `/${E.titanium}/`],
  ['/libcurl',           `/${E.libcurl}`],
  ['/wisp/',             `/${E.wisp}/`],
  ['/bare/',             `/${E.bare}/`],
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
  path.join(__dirname, '..', 'server', 'uv'),
  path.join(__dirname, '..', 'server', 'modules'),
  path.join(__dirname, '..', 'server', 'res'),
  path.join(__dirname, '..', 'server', 'kernel'),
];

console.log('\n📝 Rewriting references in bundled files...');
for (const dir of TARGET_DIRS) {
  walk(dir, (file) => {
    if (/\.(js|html|json|mjs|cjs)$/.test(file)) replaceInFile(file);
  });
}

console.log('\n✅ Endpoint generation complete.\n');