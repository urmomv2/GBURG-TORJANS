// server/server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 8080;

// ---- Load generated endpoints ----
const ENDPOINTS_FILE = path.join(__dirname, 'data', 'endpoints.json');
let ENDPOINTS;
try {
  ENDPOINTS = JSON.parse(fs.readFileSync(ENDPOINTS_FILE, 'utf8'));
} catch {
  console.error('❌ endpoints.json missing. Run: npm run gen-endpoints');
  process.exit(1);
}

const GAMES_FILE = path.join(__dirname, 'data', 'games.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'user_settings.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SCRAMJET_DIR = path.join(__dirname, 'modules', 'uv');

app.use(express.json());
app.disable('x-powered-by');

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
app.get('/api/endpoints', (req, res) => {
  res.json({
    scramjet:    ENDPOINTS.scramjet,
    ultraviolet: ENDPOINTS.ultraviolet,
    alloy:       ENDPOINTS.alloy,
    titanium:    ENDPOINTS.titanium,
    wisp:        ENDPOINTS.wisp,
    bare:        ENDPOINTS.bare,
    sw:          ENDPOINTS.sw,
  });
});

// ============================================================
//  PROXY ENGINE METADATA
// ============================================================
const PROXY_ENGINES = [
  {
    id: 'scramjet',
    name: 'Scramjet',
    description: 'Detectability-hardened interception proxy. Best for modern web apps.',
    speed: 'fast',
    endpoint: `/${ENDPOINTS.scramjet}/service/`,
    transport: `/${ENDPOINTS.scramjet}/embed.html`,
    enabled: true,
    recommended: true,
  },
  {
    id: 'ultraviolet',
    name: 'Ultraviolet',
    description: 'Service-worker based proxy. Broad compatibility.',
    speed: 'medium',
    endpoint: `/${ENDPOINTS.ultraviolet}/service/`,
    transport: `/${ENDPOINTS.ultraviolet}/embed.html`,
    enabled: true,
  },
  {
    id: 'alloy',
    name: 'Alloy',
    description: 'Lightweight proxy with hCAPTCHA support.',
    speed: 'medium',
    endpoint: `/${ENDPOINTS.alloy}/service/`,
    enabled: true,
  },
  {
    id: 'titanium',
    name: 'Titanium',
    description: 'Battle-tested. Slower on modern sites.',
    speed: 'slow',
    endpoint: `/${ENDPOINTS.titanium}/service/`,
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
  { id: 'chrome', name: 'Google Chrome', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  { id: 'brave', name: 'Brave', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Brave/120' },
  { id: 'duckduckgo', name: 'DuckDuckGo', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DuckDuckGo/120' },
  { id: 'edge', name: 'Microsoft Edge', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' },
  { id: 'firefox', name: 'Mozilla Firefox', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0' },
  { id: 'safari', name: 'Apple Safari', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15' },
];

app.get('/api/browsers', (req, res) => res.json({ browsers: BROWSERS }));

// ============================================================
//  SCRAMJET (dynamic path)
// ============================================================
express.static.mime.define({ 'application/wasm': ['wasm'] });

app.use(`/${ENDPOINTS.scramjet}/`, express.static(SCRAMJET_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
    if (filePath.endsWith(`${ENDPOINTS.sw}.js`)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Service-Worker-Allowed', `/${ENDPOINTS.scramjet}/`);
    }
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  },
}));

app.get(`/${ENDPOINTS.scramjet}/${ENDPOINTS.sw}.js`, (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', `/${ENDPOINTS.scramjet}/`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(SCRAMJET_DIR, 'scramjet.sync.js'));
});

console.log(`✅ Scramjet mounted at /${ENDPOINTS.scramjet}/`);

// ============================================================
//  ULTRAVIOLET (dynamic path)
// ============================================================
try {
  const { publicPath } = require('ultraviolet-static');
  const { uvPath } = require('@titaniumnetwork-dev/ultraviolet');
  app.use(`/${ENDPOINTS.ultraviolet}/`, express.static(uvPath));
  app.use(`/${ENDPOINTS.ultraviolet}/`, express.static(publicPath));
  console.log(`✅ Ultraviolet mounted at /${ENDPOINTS.ultraviolet}/`);
} catch (err) {
  console.warn(`⚠️ Ultraviolet skipped: ${err.message}`);
}

// ============================================================
//  PROXY CLIENT STATIC FILES
// ============================================================
const SERVICE_WORKER_FILES = [
  `${ENDPOINTS.sw}.js`,
  `${ENDPOINTS.sw}-register.js`,
  `${ENDPOINTS.ultraviolet}-sw.js`,
  'yt-register-sw.js',
  'youtube-register-sw.js',
];

app.get(SERVICE_WORKER_FILES.map(f => `/${f}`), (req, res, next) => {
  const file = req.path.replace('/', '');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(PUBLIC_DIR, file), err => err && next());
});

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

console.log('✅ Proxy client files mounted from /public/');

// ============================================================
//  SERVE BUILT FRONTEND
// ============================================================
if (fs.existsSync(DIST_DIR)) app.use(express.static(DIST_DIR));

// ============================================================
//  WISP + BARE UPGRADES (dynamic paths)
// ============================================================
const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith(`/${ENDPOINTS.wisp}/`)) {
    try {
      const wisp = require('@mercuryworkshop/wisp-js/server');
      wisp.routeRequest(req, socket, head);
    } catch (err) {
      console.warn('Wisp error:', err.message);
      socket.end();
    }
  } else if (req.url.startsWith(`/${ENDPOINTS.bare}/`)) {
    try {
      const { createBareServer } = require('@tomphttp/bare-server-node');
      const bare = createBareServer(`/${ENDPOINTS.bare}/`);
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
  console.log('📡 Endpoints:');
  console.log(`   Scramjet:    /${ENDPOINTS.scramjet}/`);
  console.log(`   Ultraviolet: /${ENDPOINTS.ultraviolet}/`);
  console.log(`   Wisp:        /${ENDPOINTS.wisp}/`);
  console.log(`   Bare:        /${ENDPOINTS.bare}/\n`);
});
