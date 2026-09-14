// server/server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 8080;

// ---- Load generated endpoints ----
const ENDPOINTS_FILE = path.join(__dirname, 'data', 'endpoints.json');
let E;
try {
  E = JSON.parse(fs.readFileSync(ENDPOINTS_FILE, 'utf8'));
} catch {
  console.error('❌ endpoints.json missing. Run: npm run gen-endpoints');
  process.exit(1);
}

const GAMES_FILE = path.join(__dirname, 'data', 'games.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'user_settings.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UV_DIR = path.join(__dirname, 'uv');
const SCRAM_MODULES_DIR = path.join(__dirname, 'modules');
const SCRAM_RES_DIR = path.join(__dirname, 'res', 'scram');
const SCRAM_KERNEL_DIR = path.join(__dirname, 'kernel', 'scram');
const STORAGE_DIR = path.join(__dirname, 'data', 'storage');

app.use(express.json());
app.disable('x-powered-by');

// ============================================================
//  ON-THE-FLY CONTENT REWRITER
// ============================================================
const rewriteProxyRefs = (content) => {
  const replacements = [
    // UV core
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

    // Scramjet
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

    // Public wrappers
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

    // Folders
    ['/alloy/service/',    `/${E.alloy}/service/`],
    ['/alloy/',            `/${E.alloy}/`],
    ['/titanium/service/', `/${E.titanium}/service/`],
    ['/titanium/',         `/${E.titanium}/`],
    ['/libcurl',           `/${E.libcurl}`],
    ['/wisp/',             `/${E.wisp}/`],
    ['/bare/',             `/${E.bare}/`],
  ];
  let out = content;
  for (const [from, to] of replacements) out = out.split(from).join(to);
  return out;
};

// ============================================================
//  GAMES API (secured)
// ============================================================
const verifyAccess = (req, res, next) => {
  if (req.headers['x-trojans-request'] !== 'true') {
    return res.status(403).json({ error: 'Access Denied' });
  }
  next();
};

app.get('/api/storage/games/api', verifyAccess, (req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(GAMES_FILE, 'utf8')));
  } catch {
    res.status(500).json({ error: 'Failed to load games' });
  }
});

// ============================================================
//  STORAGE — static files served at /storage/*
//  Maps /storage/* → server/data/storage/*
// ============================================================
app.use('/storage', express.static(STORAGE_DIR, {
  setHeaders: (res, filePath) => {
    // Cache images hard — they don't change
    if (/\.(png|jpe?g|webp|gif|svg|ico|avif)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    }
    // Never cache HTML/JS/CSS/WASM — patches should propagate immediately
    if (/\.(html?|js|css|wasm)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

console.log(`✅ Storage mounted at /storage/ → ${STORAGE_DIR}`);

// ============================================================
//  SETTINGS API
// ============================================================
const DEFAULT_SETTINGS = {
  zoom: 100,
  showGames: true, showApps: true, showAI: true,
  showMusic: true, showMovies: true, showVM: true,
  showChat: true, showTools: true,
  proxyEngine: 'scramjet', browser: 'chrome',
};

app.get('/api/user/settings', (req, res) => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return res.json({
        ...DEFAULT_SETTINGS,
        ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')),
      });
    }
    res.json(DEFAULT_SETTINGS);
  } catch {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.post('/api/user/settings', (req, res) => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ============================================================
//  ENDPOINT DISCOVERY
// ============================================================
app.get('/api/endpoints', (req, res) => res.json(E));

// ============================================================
//  PROXY ENGINE METADATA
// ============================================================
const PROXY_ENGINES = [
  {
    id: 'scramjet',
    name: 'Scramjet',
    description: 'Detectability-hardened interception proxy. Best for modern web apps.',
    speed: 'fast',
    endpoint: `/${E.scramjet}/service/`,
    enabled: true,
    recommended: true,
  },
  {
    id: 'ultraviolet',
    name: 'Ultraviolet',
    description: 'Service-worker based proxy. Broad compatibility.',
    speed: 'medium',
    endpoint: `/${E.ultraviolet}/service/`,
    enabled: true,
  },
  {
    id: 'alloy',
    name: 'Alloy',
    description: 'Lightweight proxy with hCAPTCHA support.',
    speed: 'medium',
    endpoint: `/${E.alloy}/service/`,
    enabled: true,
  },
  {
    id: 'titanium',
    name: 'Titanium',
    description: 'Battle-tested. Slower on modern sites.',
    speed: 'slow',
    endpoint: `/${E.titanium}/service/`,
    enabled: true,
  },
];

app.get('/api/proxy/engines', (req, res) => {
  res.json({ engines: PROXY_ENGINES, defaultEngine: 'scramjet' });
});

// ============================================================
//  BROWSER LIST
// ============================================================
const BROWSERS = [
  { id: 'chrome',     name: 'Google Chrome',   userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  { id: 'brave',      name: 'Brave',           userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Brave/120' },
  { id: 'duckduckgo', name: 'DuckDuckGo',      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DuckDuckGo/120' },
  { id: 'edge',       name: 'Microsoft Edge',  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' },
  { id: 'firefox',    name: 'Mozilla Firefox', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0' },
  { id: 'safari',     name: 'Apple Safari',    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15' },
];

app.get('/api/browsers', (req, res) => res.json({ browsers: BROWSERS }));

// ============================================================
//  ULTRAVIOLET
// ============================================================
const UV_HEADERS = (res, filePath) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  if (filePath.endsWith(`${E.uvSw}.js`)) {
    res.setHeader('Service-Worker-Allowed', `/${E.ultraviolet}/`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  if (filePath.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
};

const serveUVFile = (logicalName, randomId, ext) => (req, res) => {
  const filePath = path.join(UV_DIR, logicalName);
  if (!fs.existsSync(filePath)) return res.status(404).send('// not found');
  res.setHeader('Content-Type', 'application/javascript');
  UV_HEADERS(res, `${randomId}.${ext}`);
  res.send(rewriteProxyRefs(fs.readFileSync(filePath, 'utf8')));
};

app.get(`/${E.ultraviolet}/${E.uvBundle}.js`,  serveUVFile('uv.bundle.js',  E.uvBundle,  'js'));
app.get(`/${E.ultraviolet}/${E.uvClient}.js`,  serveUVFile('uv.client.js',  E.uvClient,  'js'));
app.get(`/${E.ultraviolet}/${E.uvConfig}.js`,  serveUVFile('uv.config.js',  E.uvConfig,  'js'));
app.get(`/${E.ultraviolet}/${E.uvHandler}.js`, serveUVFile('uv.handler.js', E.uvHandler, 'js'));
app.get(`/${E.ultraviolet}/${E.uvSw}.js`,      serveUVFile('uv.sw.js',      E.uvSw,      'js'));

app.use(`/${E.ultraviolet}/`, express.static(UV_DIR, {
  setHeaders: (res, filePath) => UV_HEADERS(res, filePath),
}));

console.log(`✅ Ultraviolet mounted at /${E.ultraviolet}/`);

// ============================================================
//  SCRAMJET
// ============================================================
express.static.mime.define({ 'application/wasm': ['wasm'] });

const SCRAM_HEADERS = (res, filePath) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (filePath.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
  if (filePath.endsWith('.dat'))  {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
};

const serveScramFile = (baseDir, logicalName, randomId, ext) => (req, res) => {
  const filePath = path.join(baseDir, logicalName);
  if (!fs.existsSync(filePath)) return res.status(404).send('// not found');
  if (ext === 'js') res.setHeader('Content-Type', 'application/javascript');
  SCRAM_HEADERS(res, `${randomId}.${ext}`);
  const content = fs.readFileSync(filePath, ext === 'js' ? 'utf8' : undefined);
  res.send(ext === 'js' ? rewriteProxyRefs(content) : content);
};

// modules/
app.get(`/${E.scramjet}/${E.scramBundle}.js`, serveScramFile(SCRAM_MODULES_DIR, 'scramjet.bundle.js',  E.scramBundle, 'js'));
app.get(`/${E.scramjet}/${E.scramSync}.js`,   serveScramFile(SCRAM_MODULES_DIR, 'scramjet.sync.js',    E.scramSync,   'js'));
app.get(`/${E.scramjet}/${E.scramWasm}.wasm`, serveScramFile(SCRAM_MODULES_DIR, 'scramjet.wasm.wasm',  E.scramWasm,   'wasm'));
app.get(`/${E.scramjet}/${E.scramAll}.js`,    serveScramFile(SCRAM_MODULES_DIR, 'scramjet.all.js',     E.scramAll,    'js'));
app.get(`/${E.scramjet}/${E.sjBundle}.js`,    serveScramFile(SCRAM_MODULES_DIR, 'sj.bundle.js',         E.sjBundle,    'js'));
app.get(`/${E.scramjet}/${E.sjSync}.js`,      serveScramFile(SCRAM_MODULES_DIR, 'sj.sync.js',           E.sjSync,      'js'));
app.get(`/${E.scramjet}/${E.sjWasm}.wasm`,    serveScramFile(SCRAM_MODULES_DIR, 'sj.wasm.wasm',         E.sjWasm,      'wasm'));
app.get(`/${E.scramjet}/${E.sjAll}.js`,       serveScramFile(SCRAM_MODULES_DIR, 'sj.all.js',            E.sjAll,       'js'));
app.get(`/${E.scramjet}/${E.startAll}.js`,    serveScramFile(SCRAM_MODULES_DIR, 'start.all.js',         E.startAll,    'js'));

// res/scram/
app.get(`/${E.scramjet}/${E.resMain}.js`, serveScramFile(SCRAM_RES_DIR, 'main.js', E.resMain, 'js'));
app.get(`/${E.scramjet}/${E.resSync}.js`, serveScramFile(SCRAM_RES_DIR, 'sync.js', E.resSync, 'js'));
app.get(`/${E.scramjet}/${E.resBin}`,     serveScramFile(SCRAM_RES_DIR, 'bin.dat', E.resBin,  'dat'));

// kernel/scram/
app.get(`/${E.scramjet}/${E.kernelAll}.js`,    serveScramFile(SCRAM_KERNEL_DIR, 'scramjet.all.js',    E.kernelAll,    'js'));
app.get(`/${E.scramjet}/${E.kernelBundle}.js`, serveScramFile(SCRAM_KERNEL_DIR, 'scramjet.bundle.js', E.kernelBundle, 'js'));
app.get(`/${E.scramjet}/${E.kernelSync}.js`,   serveScramFile(SCRAM_KERNEL_DIR, 'scramjet.sync.js',   E.kernelSync,   'js'));
app.get(`/${E.scramjet}/${E.kernelWasm}.wasm`, serveScramFile(SCRAM_KERNEL_DIR, 'scramjet.wasm.wasm', E.kernelWasm,   'wasm'));

// SW alias at root of scramjet namespace
app.get(`/${E.scramjet}/${E.sw}.js`, (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', `/${E.scramjet}/`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const src = path.join(SCRAM_MODULES_DIR, 'scramjet.sync.js');
  if (!fs.existsSync(src)) return res.status(404).send('// scramjet sync not found');
  res.send(rewriteProxyRefs(fs.readFileSync(src, 'utf8')));
});

console.log(`✅ Scramjet mounted at /${E.scramjet}/`);

// ============================================================
//  PUBLIC WRAPPER FILES — served at random URLs
// ============================================================
const servePublicFile = (logicalName, randomId, ext, contentType) => (req, res) => {
  const filePath = path.join(PUBLIC_DIR, logicalName);
  if (!fs.existsSync(filePath)) return res.status(404).send('// not found');

  res.setHeader('Content-Type', contentType);
  if (ext === 'html') {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  }
  if (logicalName.includes('register') || logicalName.includes('sw')) {
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  let content = fs.readFileSync(filePath, 'utf8');
  content = rewriteProxyRefs(content);
  res.send(content);
};

// HTML
app.get(`/${E.scramEmbed}.html`,   servePublicFile('scram-embed.html',   E.scramEmbed,   'html', 'text/html'));
app.get(`/${E.youtubeEmbed}.html`, servePublicFile('youtube-embed.html', E.youtubeEmbed, 'html', 'text/html'));
app.get(`/${E.googleEmbed}.html`,  servePublicFile('google-embed.html',  E.googleEmbed,  'html', 'text/html'));
app.get(`/${E.libcurlEmbed}.html`, servePublicFile('libcurl-embed.html', E.libcurlEmbed, 'html', 'text/html'));
app.get(`/${E.embedHtml}.html`,    servePublicFile('embed.html',         E.embedHtml,    'html', 'text/html'));

// JS
app.get(`/${E.uvJs}.js`,              servePublicFile('uv.js',                  E.uvJs,              'js', 'application/javascript'));
app.get(`/${E.uvSwJs}.js`,            servePublicFile('uv-sw.js',               E.uvSwJs,            'js', 'application/javascript'));
app.get(`/${E.youtubeRegisterSw}.js`, servePublicFile('youtube-register-sw.js', E.youtubeRegisterSw, 'js', 'application/javascript'));
app.get(`/${E.ytRegisterSw}.js`,      servePublicFile('yt-register-sw.js',      E.ytRegisterSw,      'js', 'application/javascript'));
app.get(`/${E.googleConfig}.js`,      servePublicFile('google-config.js',       E.googleConfig,      'js', 'application/javascript'));
app.get(`/${E.embedJs}.js`,           servePublicFile('embed.js',               E.embedJs,           'js', 'application/javascript'));
app.get(`/${E.loaderJs}.js`,          servePublicFile('loader.js',              E.loaderJs,          'js', 'application/javascript'));
app.get(`/${E.pageJs}.js`,            servePublicFile('page.js',                E.pageJs,            'js', 'application/javascript'));
app.get(`/${E.searchJs}.js`,          servePublicFile('search.js',              E.searchJs,          'js', 'application/javascript'));
app.get(`/${E.indexJs}.js`,           servePublicFile('index.js',               E.indexJs,           'js', 'application/javascript'));
app.get(`/${E.registerSw}.js`,        servePublicFile('register-sw.js',         E.registerSw,        'js', 'application/javascript'));
app.get(`/${E.swJs}.js`,              servePublicFile('sw.js',                  E.swJs,              'js', 'application/javascript'));

console.log('✅ Public wrapper files mounted at random URLs');

// ============================================================
//  STATIC FALLBACK FOR PUBLIC DIR
//  (configs, iframe.html, index.html, tor-config.js, etc.)
// ============================================================
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    }
    if (filePath.includes('config') || filePath.includes('register')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
}));

// ============================================================
//  SERVE BUILT FRONTEND
// ============================================================
if (fs.existsSync(DIST_DIR)) app.use(express.static(DIST_DIR));

// ============================================================
//  WISP + BARE UPGRADES
// ============================================================
const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith(`/${E.wisp}/`)) {
    try {
      const wisp = require('@mercuryworkshop/wisp-js/server');
      wisp.routeRequest(req, socket, head);
    } catch (err) {
      console.warn('Wisp error:', err.message);
      socket.end();
    }
  } else if (req.url.startsWith(`/${E.bare}/`)) {
    try {
      const { createBareServer } = require('@tomphttp/bare-server-node');
      const bare = createBareServer(`/${E.bare}/`);
      if (bare.shouldRoute(req)) bare.routeUpgrade(req, socket, head);
      else socket.end();
    } catch (err) {
      console.warn('Bare error:', err.message);
      socket.end();
    }
  } else {
    socket.end();
  }
});

// ============================================================
//  SPA FALLBACK
// ============================================================
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API not found' });
  }
  const index = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(index)) res.sendFile(index);
  else res.status(200).send('Trojans Proxy Hub is running.');
});

server.listen(PORT, () => {
  console.log(`\n🚀 Trojans Proxy Hub on http://localhost:${PORT}\n`);
  console.log('📡 Random URLs:');
  console.log(`   UV:          /${E.ultraviolet}/`);
  console.log(`   Scramjet:    /${E.scramjet}/`);
  console.log(`   Wisp:        /${E.wisp}/`);
  console.log(`   Bare:        /${E.bare}/`);
  console.log(`   Storage:     /storage/\n`);
});