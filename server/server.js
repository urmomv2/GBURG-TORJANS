// ============================================================
//  Trojans Proxy Hub — Backend Server
// ============================================================
//  A single-file Express backend that:
//    • Serves the built React frontend (from /dist)
//    • Serves static game files + images (from server/data/storage)
//    • Exposes a secured API for the game catalog
//    • Mounts five proxy engines (Scramjet, UV, Static UV, Alloy, Tor)
//    • Handles WISP + Bare WebSocket upgrades
//    • Persists user settings
//    • Provides AI chat via Groq (GPT-OSS 120B / 20B)
//    • Provides music search/stream via iTunes + media proxy
//    • Proxies cover images (YouTube/iTunes/SoundCloud)
//    • Tracks Firefox WASM VM sessions
//    • Runs a unified monitor (self-ping + memory + disk watchdog)
//      that auto-resets the process if resources near platform limits
// ============================================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ---- Local modules ----
const mediaProxy = require('./media-proxy');
const monitor = require('./monitor');
const vmSessions = require('./vm-sessions');
const { encodeMediaUrl } = mediaProxy;

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

// ---- Paths ----
const GAMES_FILE    = path.join(__dirname, 'data', 'games.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'user_settings.json');
const STORAGE_DIR   = path.join(__dirname, 'data', 'storage');
const UV_DIR        = path.join(__dirname, 'uv');
const ALLOY_DIR     = path.join(__dirname, 'node_modules', 'alloyproxy', 'public');
const PUBLIC_DIR    = path.join(__dirname, '..', 'public');
const DIST_DIR      = path.join(__dirname, '..', 'dist');
const STATIC_UV_DIR = path.join(PUBLIC_DIR, 'static', 'uv');
const TROJANS_DIR   = path.join(PUBLIC_DIR, 'trojans');
const VM_DIR        = path.join(PUBLIC_DIR, 'firefox-wasm');

app.use(express.json());
app.disable('x-powered-by');

const normPath = (p) => p.split(path.sep).join('/');

// ============================================================
//  ENV — server-only secrets
// ============================================================
require('dotenv').config({ path: path.join(__dirname, '.env') });

const GROQ_API_KEY           = process.env.GROQ_API_KEY || '';
const GROQ_MODEL             = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_REASONING_EFFORT  = process.env.GROQ_REASONING_EFFORT || 'medium';
const GROQ_INCLUDE_REASONING = process.env.GROQ_INCLUDE_REASONING === 'true';
const GROQ_MAX_TOKENS        = parseInt(process.env.GROQ_MAX_TOKENS || '1024', 10);
const AI_RATE_LIMIT          = parseInt(process.env.AI_RATE_LIMIT || '20', 10);

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

if (GROQ_API_KEY) {
  console.log(`✅ Groq AI enabled`);
  console.log(`   Default model:  ${GROQ_MODEL}`);
  console.log(`   Reasoning:      ${GROQ_REASONING_EFFORT}`);
} else {
  console.warn('⚠️  AI disabled — set GROQ_API_KEY in server/.env');
}

// ---- AI rate limiter ----
const aiRateMap = new Map();
const aiRateCheck = (ip) => {
  const now = Date.now();
  const window = 60_000;
  const hits = (aiRateMap.get(ip) || []).filter((t) => now - t < window);
  if (hits.length >= AI_RATE_LIMIT) return false;
  hits.push(now);
  aiRateMap.set(ip, hits);
  return true;
};
setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of aiRateMap.entries()) {
    const fresh = hits.filter((t) => now - t < 60_000);
    if (fresh.length === 0) aiRateMap.delete(ip);
    else aiRateMap.set(ip, fresh);
  }
}, 60_000).unref?.();

// ============================================================
//  HEALTH
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

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
  try { res.json(JSON.parse(fs.readFileSync(GAMES_FILE, 'utf8'))); }
  catch { res.status(500).json({ error: 'Failed to load games' }); }
});

// ============================================================
//  STORAGE
// ============================================================
app.use('/storage', express.static(STORAGE_DIR, {
  setHeaders: (res, filePath) => {
    const p = normPath(filePath);
    if (/\.(png|jpe?g|webp|gif|svg|ico|avif)$/i.test(p)) {
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    }
    if (/\.(html?|js|css|wasm)$/i.test(p)) res.setHeader('Cache-Control', 'no-cache');
  },
}));

console.log(`✅ Storage mounted at /storage/ → ${STORAGE_DIR}`);

// ============================================================
//  SETTINGS API
// ============================================================
const DEFAULT_SETTINGS = {
  zoom: 100,
  showGames: true, showApps: true, showAI: true, showEducation: true,
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
  } catch { res.status(500).json({ error: 'Failed to load settings' }); }
});

app.post('/api/user/settings', (req, res) => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed to save settings' }); }
});

// ============================================================
//  AI — Groq models
// ============================================================
const GROQ_MODELS = [
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    description: 'Largest open-weight model. Best reasoning quality.',
    speed: 'medium',
    context: 131072,
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    description: 'Smaller, faster. Good for quick questions.',
    speed: 'fast',
    context: 131072,
  },
];

app.get('/api/ai/models', (req, res) => {
  res.json({
    enabled: !!GROQ_API_KEY,
    defaultModel: GROQ_MODEL,
    defaultReasoning: GROQ_REASONING_EFFORT,
    models: GROQ_MODELS,
    reasoningLevels: ['low', 'medium', 'high'],
  });
});

app.post('/api/ai/chat', async (req, res) => {
  if (!GROQ_API_KEY) {
    return res.status(503).json({ error: 'AI not configured. Set GROQ_API_KEY in server/.env' });
  }

  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!aiRateCheck(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
  }

  const { messages, model, reasoning_effort, include_reasoning, max_tokens } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const modelId = model && GROQ_MODELS.some((m) => m.id === model) ? model : GROQ_MODEL;
  const effort = ['low', 'medium', 'high'].includes(reasoning_effort)
    ? reasoning_effort
    : GROQ_REASONING_EFFORT;

  const payload = {
    model: modelId,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_completion_tokens: max_tokens || GROQ_MAX_TOKENS,
    reasoning_effort: effort,
    include_reasoning: include_reasoning === true ? true : GROQ_INCLUDE_REASONING,
  };

  try {
    const r = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();

    if (!r.ok) {
      console.error('Groq error:', data);
      return res.status(r.status).json({
        error: data.error?.message || 'Groq request failed',
      });
    }

    const choice = data.choices?.[0];
    return res.json({
      reply: choice?.message?.content || '',
      reasoning: choice?.message?.reasoning || null,
      provider: 'groq',
      model: data.model,
      reasoningEffort: effort,
      usage: data.usage || null,
      finishReason: choice?.finish_reason || null,
    });
  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ error: 'AI request failed', detail: err.message });
  }
});

// ============================================================
//  AI GENERATE — endpoint for TrojansAI.tsx
// ============================================================
app.post('/api/generate', async (req, res) => {
  if (!GROQ_API_KEY) {
    return res.status(503).json({ error: 'AI not configured. Set GROQ_API_KEY in server/.env' });
  }

  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!aiRateCheck(ip)) {
    return res.status(429).json({ detail: 'Rate limit exceeded. Try again in a minute.' });
  }

  const { prompt, model, system, groqMessages } = req.body || {};

  let messages = Array.isArray(groqMessages) && groqMessages.length
    ? groqMessages
    : [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt || '' },
      ];

  if (system && messages[0]?.role !== 'system') {
    messages = [{ role: 'system', content: system }, ...messages];
  }

  if (!messages.length) {
    return res.status(400).json({ detail: 'No messages provided' });
  }

  const modelId = model || GROQ_MODEL;
  const isVision = messages.some(
    (m) => Array.isArray(m.content) && m.content.some((c) => c.type === 'image_url'),
  );

  const payload = {
    model: modelId,
    messages,
    max_completion_tokens: GROQ_MAX_TOKENS,
  };

  if (!isVision && modelId.startsWith('openai/gpt-oss')) {
    payload.reasoning_effort = GROQ_REASONING_EFFORT;
    payload.include_reasoning = GROQ_INCLUDE_REASONING;
  }

  try {
    const r = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();

    if (!r.ok) {
      console.error('Groq error:', data);
      return res.status(r.status).json({
        detail: data.error?.message || 'Groq request failed',
      });
    }

    const reply = data.choices?.[0]?.message?.content || '';
    return res.json({
      response: reply,
      model: data.model,
      usage: data.usage,
    });
  } catch (err) {
    console.error('Generate error:', err.message);
    res.status(500).json({ detail: 'AI request failed' });
  }
});

// ============================================================
//  MUSIC — search / browse / trending / track / play
// ============================================================

app.get('/api/music/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ tracks: [] });

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=30`;
    const r = await fetch(url);
    const data = await r.json();

    const tracks = (data.results || []).map((item) => {
      const preview = item.previewUrl;
      const id = preview
        ? 'preview-' + Buffer.from(preview).toString('base64url')
        : 'itunes-' + item.trackId;

      return {
        id,
        title: item.trackName || 'Unknown',
        artist: item.artistName || 'Unknown',
        artwork:
          item.artworkUrl100?.replace('100x100bb', '400x400bb') ||
          item.artworkUrl100 ||
          null,
        duration: item.trackTimeMillis || 0,
        permalink_url: item.trackViewUrl || null,
        genre: item.primaryGenreName || null,
      };
    });

    res.json({ tracks });
  } catch (err) {
    console.error('Music search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/music/browse', (req, res) => res.json({ sections: [] }));
app.get('/api/music/trending', (req, res) => res.json({ tracks: [] }));

app.get('/api/music/track/:id', async (req, res) => {
  const { id } = req.params;

  if (id.startsWith('itunes-')) {
    try {
      const trackId = id.slice(7);
      const r = await fetch(`https://itunes.apple.com/lookup?id=${trackId}`);
      const data = await r.json();
      const item = data.results?.[0];
      if (item) {
        return res.json({
          track: {
            id,
            title: item.trackName || 'Unknown',
            artist: item.artistName || 'Unknown',
            artwork: item.artworkUrl100?.replace('100x100bb', '400x400bb') || null,
            duration: item.trackTimeMillis || 0,
            permalink_url: item.trackViewUrl || null,
            genre: item.primaryGenreName || null,
          },
        });
      }
    } catch {}
  }

  res.json({ track: null });
});

app.get('/api/music/play/:id', async (req, res) => {
  const { id } = req.params;
  const title = String(req.query.t || '');
  const artist = String(req.query.a || '');

  if (id.startsWith('yt') && id.length > 2) {
    return res.json({ provider: 'youtube', videoId: id.slice(2) });
  }

  if (id.startsWith('sc') && id.length > 2) {
    return res.json({ provider: 'soundcloud', soundcloudId: id.slice(2) });
  }

  if (id.startsWith('preview-')) {
    try {
      const url = Buffer.from(id.slice(8), 'base64url').toString();
      if (url.startsWith('http')) {
        return res.json({
          audioUrl: `/api/music/media/${encodeMediaUrl(url)}`,
        });
      }
    } catch {}
  }

  if (id.startsWith('itunes-')) {
    try {
      const trackId = id.slice(7);
      const r = await fetch(`https://itunes.apple.com/lookup?id=${trackId}`);
      const data = await r.json();
      const item = data.results?.[0];
      if (item?.previewUrl) {
        return res.json({
          audioUrl: `/api/music/media/${encodeMediaUrl(item.previewUrl)}`,
        });
      }
    } catch {}
  }

  if (title) {
    try {
      const term = artist ? `${title} ${artist}` : title;
      const r = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=1`,
      );
      const data = await r.json();
      const item = data.results?.[0];
      if (item?.previewUrl) {
        return res.json({
          audioUrl: `/api/music/media/${encodeMediaUrl(item.previewUrl)}`,
        });
      }
    } catch {}
  }

  return res.status(404).json({ error: 'No playable source for this track' });
});

// ---- Music media stream proxy (Range-aware) ----
app.get('/api/music/media/:token', mediaProxy.proxyMedia);
console.log('✅ Music media proxy at /api/music/media/');

// ============================================================
//  COVER PROXY — /api/cover/<encrypted-url>
// ============================================================
const COVER_XOR_KEY = Buffer.from([116, 114, 111, 106, 97, 110, 115, 33]); // "trojans!"

function decodeCoverToken(token) {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = Buffer.from(padded, 'base64').toString('binary');
    let out = '';
    for (let i = 0; i < bin.length; i++) {
      out += String.fromCharCode(
        bin.charCodeAt(i) ^ COVER_XOR_KEY[i % COVER_XOR_KEY.length],
      );
    }
    return decodeURIComponent(out);
  } catch {
    return null;
  }
}

const coverCache = new Map();
const COVER_CACHE_MAX = 500;
const COVER_CACHE_TTL_MS = 10 * 60 * 1000;

function coverCacheGet(key) {
  const hit = coverCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > COVER_CACHE_TTL_MS) {
    coverCache.delete(key);
    return null;
  }
  return hit;
}

function coverCacheSet(key, buf, contentType) {
  if (coverCache.size >= COVER_CACHE_MAX) {
    const oldest = coverCache.keys().next().value;
    coverCache.delete(oldest);
  }
  coverCache.set(key, { at: Date.now(), buf, contentType });
}

app.get('/api/cover/:token', async (req, res) => {
  const target = decodeCoverToken(req.params.token);
  if (!target || !/^https?:\/\//i.test(target)) {
    return res.status(400).send('// Invalid cover token');
  }

  const ALLOWED_HOSTS = [
    'i.ytimg.com', 'img.youtube.com',
    'is1-ssl.mzstatic.com', 'is2-ssl.mzstatic.com', 'is3-ssl.mzstatic.com',
    'is4-ssl.mzstatic.com', 'is5-ssl.mzstatic.com',
    'i1.sndcdn.com', 'i2.sndcdn.com', 'i3.sndcdn.com', 'i4.sndcdn.com', 'i5.sndcdn.com',
  ];

  try {
    const host = new URL(target).hostname.toLowerCase();
    if (!ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h))) {
      return res.status(403).send('// Host not allowed');
    }
  } catch {
    return res.status(400).send('// Bad URL');
  }

  const cached = coverCacheGet(req.params.token);
  if (cached) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    return res.send(cached.buf);
  }

  try {
    const r = await fetch(target, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!r.ok) return res.status(r.status).send('// Upstream error');

    const contentType = r.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return res.status(415).send('// Not an image');
    }

    const arrayBuf = await r.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    coverCacheSet(req.params.token, buf, contentType);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.send(buf);
  } catch (err) {
    console.error('Cover proxy error:', err.message);
    res.status(502).send('// Upstream fetch failed');
  }
});

console.log('✅ Cover proxy mounted at /api/cover/');

// ============================================================
//  VM — session tracking (public, rate-limited, no auth)
// ============================================================
app.post('/api/vm/heartbeat', (req, res) => vmSessions.heartbeat(req, res));
app.post('/api/vm/end',       (req, res) => vmSessions.end(req, res));
app.get('/api/vm/status',     (req, res) => vmSessions.status(req, res));

console.log('✅ VM session tracking mounted at /api/vm/');

// ---- Serve the vendored Firefox WASM assets (if present) ----
if (fs.existsSync(VM_DIR)) {
  app.use('/firefox-wasm', express.static(VM_DIR, {
    setHeaders: (res, filePath) => {
      const p = normPath(filePath);
      // WASM binary + compressed assets → long cache, immutable
      if (/\.(wasm|zst)$/i.test(p)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      // JS bundles are content-hashed, safe to cache hard
      else if (p.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      }
      // HTML entry point → revalidate so updates propagate
      else if (p.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
      // Correct WASM MIME
      if (p.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
      }
      // COOP/COEP so the VM can use SharedArrayBuffer
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    },
  }));
  console.log(`✅ Firefox WASM mounted at /firefox-wasm/ → ${VM_DIR}`);
} else {
  console.warn('⚠️  Firefox WASM not vendored — run: npm run vendor:firefox-wasm');
}

// ============================================================
//  PROXY ENGINE METADATA
// ============================================================
app.get('/api/proxy/engines', (req, res) => {
  res.json({
    engines: [
      {
        id: 'scramjet',
        name: 'Scramjet',
        description: 'Fastest connection. Rewrites requests at the browser level.',
        longDesc:
          'Connects through a service worker that intercepts every request before ' +
          'it leaves the browser, then rewrites it on the fly. Uses a compiled ' +
          'WASM codec for maximum throughput and includes anti-detection layers ' +
          'so the target site sees a normal-looking session.',
        speed: 'fast',
        endpoint: '/embed.html',
        enabled: true,
        recommended: true,
        protocol: 'WISP (WebSocket)',
        anonymity: 'low',
        bestFor: ['Everyday browsing', 'WebSockets', 'Sites with CAPTCHAs', 'Login-heavy apps'],
        limitations: ['Requires WASM + SharedArrayBuffer', 'Higher memory usage'],
      },
      {
        id: 'ultraviolet',
        name: 'Ultraviolet',
        description: 'Most compatible. Works on nearly every site.',
        longDesc:
          'The most widely deployed connection method. Its service worker hooks ' +
          'into fetch calls and rewrites them in JavaScript — works on a broader ' +
          'range of sites than any other engine here, including legacy ones.',
        speed: 'medium',
        endpoint: `/${E.trojans}/`,
        enabled: true,
        recommended: false,
        protocol: 'WISP (WebSocket)',
        anonymity: 'low',
        bestFor: ['General browsing', 'Older sites', 'Fallback when Scramjet fails'],
        limitations: ['No WASM acceleration', 'Struggles with some WebAssembly apps'],
      },
      {
        id: 'static-uv',
        name: 'Static UV',
        description: 'Isolated UV instance. Runs on its own scope.',
        longDesc:
          'A completely separate Ultraviolet installation served from a different ' +
          'path. Because its service worker has its own scope, it never conflicts ' +
          'with the main UV connection.',
        speed: 'medium',
        endpoint: `/${E.staticUv}/`,
        enabled: true,
        recommended: false,
        protocol: 'WISP (WebSocket)',
        anonymity: 'low',
        bestFor: ['Debugging', 'Fallback connection', 'Isolating UV state'],
        limitations: ['Duplicate resources', 'Two SWs active at once'],
      },
      {
        id: 'alloy',
        name: 'Alloy',
        description: 'Lightweight connection with hCAPTCHA handling.',
        longDesc:
          'A smaller, simpler connection method with built-in support for hCAPTCHA ' +
          'challenges. Great for sites that aggressively block other proxies.',
        speed: 'medium',
        endpoint: '/alloy/',
        enabled: true,
        recommended: false,
        protocol: 'Bare (HTTP/WS)',
        anonymity: 'low',
        bestFor: ['hCAPTCHA-protected sites', 'Low-resource connections'],
        limitations: ['No longer maintained', 'Weaker on modern frameworks'],
      },
      {
        id: 'tor',
        name: 'Tor',
        description: 'Routes through Tor. Slow but untraceable.',
        longDesc:
          'Forwards every request through the Tor network, so the target site ' +
          'sees a random exit node instead of your real IP.',
        speed: 'slow',
        endpoint: '/embed.html',
        enabled: true,
        recommended: false,
        protocol: 'Tor (onion routing)',
        anonymity: 'high',
        bestFor: ['Maximum anonymity', 'Bypassing IP blocks', 'Uncensored access'],
        limitations: ['High latency', 'Many sites block Tor exits', 'Bad for streaming'],
      },
    ],
    defaultEngine: 'scramjet',
  });
});

// ============================================================
//  BROWSER METADATA
// ============================================================
app.get('/api/browsers', (req, res) => {
  res.json({
    browsers: [
      { id: 'chrome',     name: 'Google Chrome',   description: 'Most compatible.' },
      { id: 'brave',      name: 'Brave',           description: 'Chromium-based. Ad-blocks.' },
      { id: 'duckduckgo', name: 'DuckDuckGo',      description: 'Privacy-focused fingerprint.' },
      { id: 'edge',       name: 'Microsoft Edge',  description: 'Windows-only block bypass.' },
      { id: 'firefox',    name: 'Mozilla Firefox', description: 'For Chrome-blocking sites.' },
      { id: 'safari',     name: 'Apple Safari',    description: 'iOS-exclusive features.' },
    ],
  });
});

// ============================================================
//  ENDPOINTS DISCOVERY
// ============================================================
app.get('/api/endpoints', (req, res) => res.json(E));

// ============================================================
//  HEADERS HELPERS
// ============================================================
const WASM_HEADERS = (res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
};

const serveAliased = ({
  diskPath,
  contentType = 'application/javascript',
  swScope = null,
  noCache = false,
  rewrites = [],
}) => (req, res, next) => {
  if (!fs.existsSync(diskPath)) return next();

  res.setHeader('Content-Type', contentType);
  WASM_HEADERS(res);

  if (swScope) {
    res.setHeader('Service-Worker-Allowed', swScope);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  } else if (noCache) {
    res.setHeader('Cache-Control', 'no-store');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  }

  let content = fs.readFileSync(diskPath, 'utf8');
  for (const [from, to] of rewrites) content = content.split(from).join(to);
  res.send(content);
};

// ============================================================
//  UV COPY #2 — server/uv/ → /{E.uv}/
// ============================================================
const UV_FILE_MAP = {
  [E.uvBundle]:  'uv.bundle.js',
  [E.uvClient]:  'uv.client.js',
  [E.uvConfig]:  'uv.config.js',
  [E.uvHandler]: 'uv.handler.js',
  [E.uvSw]:      'uv.sw.js',
};

const UV_INTERNAL_REWRITES = [
  ['/uv/uv.bundle.js',  `/${E.uv}/${E.uvBundle}.js`],
  ['/uv/uv.client.js',  `/${E.uv}/${E.uvClient}.js`],
  ['/uv/uv.config.js',  `/${E.uv}/${E.uvConfig}.js`],
  ['/uv/uv.handler.js', `/${E.uv}/${E.uvHandler}.js`],
  ['/uv/uv.sw.js',      `/${E.uv}/${E.uvSw}.js`],
  ['/uv/',              `/${E.uv}/`],
];

for (const [alias, diskName] of Object.entries(UV_FILE_MAP)) {
  const isSw = diskName === 'uv.sw.js';
  const isConfig = diskName === 'uv.config.js';

  app.get(`/${E.uv}/${alias}.js`, serveAliased({
    diskPath: path.join(UV_DIR, diskName),
    swScope: isSw ? `/${E.uv}/` : null,
    noCache: isConfig,
    rewrites: UV_INTERNAL_REWRITES,
  }));
}

app.use(`/${E.uv}/`, express.static(UV_DIR, {
  setHeaders: (res) => {
    WASM_HEADERS(res);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  },
}));

console.log(`✅ UV #2 mounted at /${E.uv}/ → ${UV_DIR}`);

// ============================================================
//  UV COPY #1 — public/static/uv/ → /{E.staticUv}/
// ============================================================
const STATIC_UV_FILE_MAP = {
  [E.uvBundle]: 'uv.bundle.js',
  [E.uvConfig]: 'uv.config.js',
  [E.uvSw]:     'uv.sw.js',
};

const STATIC_UV_INTERNAL_REWRITES = [
  ['/static/uv/uv.bundle.js', `/${E.staticUv}/${E.uvBundle}.js`],
  ['/static/uv/uv.config.js', `/${E.staticUv}/${E.uvConfig}.js`],
  ['/static/uv/uv.sw.js',     `/${E.staticUv}/${E.uvSw}.js`],
  ['/static/uv/',             `/${E.staticUv}/`],
];

for (const [alias, diskName] of Object.entries(STATIC_UV_FILE_MAP)) {
  const isSw = diskName === 'uv.sw.js';
  const isConfig = diskName === 'uv.config.js';

  app.get(`/${E.staticUv}/${alias}.js`, serveAliased({
    diskPath: path.join(STATIC_UV_DIR, diskName),
    swScope: isSw ? `/${E.staticUv}/` : null,
    noCache: isConfig,
    rewrites: STATIC_UV_INTERNAL_REWRITES,
  }));
}

app.use(`/${E.staticUv}/`, express.static(STATIC_UV_DIR, {
  setHeaders: (res) => {
    WASM_HEADERS(res);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  },
}));

console.log(`✅ UV #1 mounted at /${E.staticUv}/ → ${STATIC_UV_DIR}`);

// ============================================================
//  TROJANS UV — public/trojans/ → /{E.trojans}/
// ============================================================
const TROJANS_FILE_MAP = {
  [E.trojBundle]:  'bundle.js',
  [E.trojConfig]:  'config.js',
  [E.trojHandler]: 'handler.js',
  [E.trojSw]:      'sw.js',
  [E.trojRizzSw]:  'rizz.sw.js',
};

const TROJANS_INTERNAL_REWRITES = [
  ['/trojans/bundle.js',  `/${E.trojans}/${E.trojBundle}.js`],
  ['/trojans/config.js',  `/${E.trojans}/${E.trojConfig}.js`],
  ['/trojans/handler.js', `/${E.trojans}/${E.trojHandler}.js`],
  ['/trojans/rizz.sw.js', `/${E.trojans}/${E.trojRizzSw}.js`],
  ['/trojans/sw.js',      `/${E.trojans}/${E.trojSw}.js`],
  ['/trojans/',           `/${E.trojans}/`],
];

for (const [alias, diskName] of Object.entries(TROJANS_FILE_MAP)) {
  const isSw = diskName.endsWith('sw.js');
  const isConfig = diskName === 'config.js';

  app.get(`/${E.trojans}/${alias}.js`, serveAliased({
    diskPath: path.join(TROJANS_DIR, diskName),
    swScope: isSw ? `/${E.trojans}/` : null,
    noCache: isConfig,
    rewrites: TROJANS_INTERNAL_REWRITES,
  }));
}

app.use(`/${E.trojans}/`, express.static(TROJANS_DIR, {
  setHeaders: (res) => {
    WASM_HEADERS(res);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  },
}));

console.log(`✅ Trojans UV mounted at /${E.trojans}/ → ${TROJANS_DIR}`);

// ============================================================
//  PUBLIC BOOTSTRAPS
// ============================================================
const UV_MASTER_REWRITES = [
  ['/uv/uv.bundle.js',  `/${E.uv}/${E.uvBundle}.js`],
  ['/uv/uv.client.js',  `/${E.uv}/${E.uvClient}.js`],
  ['/uv/uv.config.js',  `/${E.uv}/${E.uvConfig}.js`],
  ['/uv/uv.handler.js', `/${E.uv}/${E.uvHandler}.js`],
  ['/uv/uv.sw.js',      `/${E.uv}/${E.uvSw}.js`],
  ['/uv/',              `/${E.uv}/`],
  ['/static/uv/uv.bundle.js', `/${E.staticUv}/${E.uvBundle}.js`],
  ['/static/uv/uv.config.js', `/${E.staticUv}/${E.uvConfig}.js`],
  ['/static/uv/uv.sw.js',     `/${E.staticUv}/${E.uvSw}.js`],
  ['/static/uv/',             `/${E.staticUv}/`],
  ['/trojans/bundle.js',  `/${E.trojans}/${E.trojBundle}.js`],
  ['/trojans/config.js',  `/${E.trojans}/${E.trojConfig}.js`],
  ['/trojans/handler.js', `/${E.trojans}/${E.trojHandler}.js`],
  ['/trojans/rizz.sw.js', `/${E.trojans}/${E.trojRizzSw}.js`],
  ['/trojans/sw.js',      `/${E.trojans}/${E.trojSw}.js`],
  ['/trojans/',           `/${E.trojans}/`],
];

app.get(`/${E.uvJs}.js`, serveAliased({
  diskPath: path.join(PUBLIC_DIR, 'uv.js'),
  rewrites: UV_MASTER_REWRITES,
}));

app.get(`/${E.uvSwJs}.js`, serveAliased({
  diskPath: path.join(PUBLIC_DIR, 'uv-sw.js'),
  swScope: '/',
  rewrites: UV_MASTER_REWRITES,
}));

app.get(`/${E.registerSw}.js`, serveAliased({
  diskPath: path.join(PUBLIC_DIR, 'register-sw.js'),
  swScope: '/',
  rewrites: UV_MASTER_REWRITES,
}));

console.log(`✅ Public bootstraps at /${E.uvJs}.js, /${E.uvSwJs}.js, /${E.registerSw}.js`);

// ============================================================
//  ALLOY
// ============================================================
if (fs.existsSync(ALLOY_DIR)) {
  app.use('/alloy', express.static(ALLOY_DIR, {
    setHeaders: (res, filePath) => {
      const p = normPath(filePath);
      if (p.endsWith('alloy.sw.js')) {
        res.setHeader('Service-Worker-Allowed', '/alloy/');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      }
      WASM_HEADERS(res);
      if (p.endsWith('alloy.config.js')) res.setHeader('Cache-Control', 'no-store');
      if (p.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
    },
  }));
  console.log(`✅ Alloy mounted at /alloy/ → ${ALLOY_DIR}`);
}

// ============================================================
//  SCRAMJET MOUNTS
// ============================================================
app.use(`/${E.scramjet}/`, express.static(path.join(PUBLIC_DIR, 'q9vx'), {
  setHeaders: (res, filePath) => {
    const p = normPath(filePath);
    WASM_HEADERS(res);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    if (p.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
  },
}));

app.use(`/${E.clipmux}/`, express.static(path.join(PUBLIC_DIR, 'm4thx'), {
  setHeaders: (res, filePath) => {
    const p = normPath(filePath);
    WASM_HEADERS(res);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    if (p.endsWith('.mjs')) res.setHeader('Content-Type', 'application/javascript');
    if (p.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
  },
}));

app.use(`/${E.wisp1}/`, express.static(path.join(PUBLIC_DIR, 'e7px'), {
  setHeaders: (res, filePath) => {
    const p = normPath(filePath);
    WASM_HEADERS(res);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    if (p.endsWith('.mjs')) res.setHeader('Content-Type', 'application/javascript');
  },
}));

app.use(`/${E.wisp2}/`, express.static(path.join(PUBLIC_DIR, 'l9cx'), {
  setHeaders: (res, filePath) => {
    const p = normPath(filePath);
    WASM_HEADERS(res);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    if (p.endsWith('.mjs')) res.setHeader('Content-Type', 'application/javascript');
  },
}));

app.use(`/${E.rivet}/`, express.static(path.join(PUBLIC_DIR, 'b', 'rivet'), {
  setHeaders: (res) => {
    WASM_HEADERS(res);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  },
}));

console.log(`✅ Scramjet at /${E.scramjet}/ · ClipMux at /${E.clipmux}/ · WISP at /${E.wisp1}/ + /${E.wisp2}/`);

// ============================================================
//  SCRAMJET SW BOOTSTRAP
// ============================================================
app.get(`/${E.sw}.js`, serveAliased({
  diskPath: path.join(PUBLIC_DIR, '1k123.js'),
  swScope: '/',
  rewrites: [
    ['/q9vx/',   `/${E.scramjet}/`],
    ['/m4thx/',  `/${E.clipmux}/`],
    ['/e7px/',   `/${E.wisp1}/`],
    ['/l9cx/',   `/${E.wisp2}/`],
    ['/b/rivet/',`/${E.rivet}/`],
    ['q9vx/',    `${E.scramjet}/`],
    ['m4thx/',   `${E.clipmux}/`],
    ['e7px/',    `${E.wisp1}/`],
    ['l9cx/',    `${E.wisp2}/`],
    ['1k123.js', `${E.sw}.js`],
  ],
}));

// ============================================================
//  BLOCK ORIGINAL PATHS
// ============================================================
const BLOCKED_PREFIXES = [
  '/uv.js', '/uv-sw.js', '/register-sw.js',
  '/static/uv/', '/trojans/',
  '/q9vx/', '/m4thx/', '/e7px/', '/l9cx/',
  '/b/rivet/', '/1k123.js',
];

BLOCKED_PREFIXES.forEach((p) => {
  app.use(p, (req, res) => res.status(404).send('// Not found'));
});

// ============================================================
//  STATIC — remaining public/ files
// ============================================================
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, filePath) => {
    const p = normPath(filePath);
    if (p.endsWith('.html')) WASM_HEADERS(res);
    if (p.includes('config') || p.includes('register')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    if (p.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
  },
}));

// ============================================================
//  BUILT FRONTEND
// ============================================================
if (fs.existsSync(DIST_DIR)) app.use(express.static(DIST_DIR));

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

// ============================================================
//  HTTP SERVER + WEBSOCKET UPGRADES
// ============================================================
const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/api/websocket')) {
    try {
      const wisp = require('@mercuryworkshop/wisp-js/server');
      wisp.routeRequest(req, socket, head);
    } catch (err) { console.warn('Wisp error:', err.message); socket.end(); }
  } else if (req.url.startsWith('/api/edge')) {
    try {
      const { createBareServer } = require('@tomphttp/bare-server-node');
      const bare = createBareServer('/api/edge/');
      if (bare.shouldRoute(req)) bare.routeUpgrade(req, socket, head);
      else socket.end();
    } catch (err) { console.warn('Bare error:', err.message); socket.end(); }
  } else { socket.end(); }
});

// ============================================================
//  UNIFIED MONITOR
// ============================================================
//  One timer, one set of handlers, one endpoint.
//
//  On every tick (default 1s):
//    • Self-pings /api/health → tracks uptime + latency
//
//  On every Nth tick (default 30th):
//    • Reads RSS memory → tracks memory pressure
//    • Reads disk usage → tracks disk pressure
//
//  If memory OR disk stays above the hard limit for N checks
//  in a row, the process exits → platform restarts fresh.
//
//  Tunable via env vars:
//    MONITOR_DISABLED               — set "true" to disable
//    MONITOR_TICK_INTERVAL_MS       — default 1000
//    MONITOR_RESOURCE_EVERY_N       — default 30
//    MONITOR_MAX_MEMORY_MB          — default 480 (Render/Railway)
//    MONITOR_MAX_DISK_PERCENT       — default 85
//    MONITOR_MIN_FREE_DISK_MB       — default 100
//    MONITOR_CONSECUTIVE_BREACH     — default 2
// ============================================================

app.get('/api/monitor', (req, res) => {
  res.json({
    ...monitor.status(),
    memory: monitor.getMemoryStats(),
    uptime: process.uptime(),
  });
});

monitor.start(server, PORT);

// ============================================================
//  START
// ============================================================
server.listen(PORT, () => {
  console.log(`\n🚀 Trojans Proxy Hub on http://localhost:${PORT}\n`);
  console.log('🔐 Frozen aliases (Mode B):');
  console.log(`   Scramjet:      /${E.scramjet}/`);
  console.log(`   ClipMux:       /${E.clipmux}/`);
  console.log(`   WISP #1:       /${E.wisp1}/`);
  console.log(`   WISP #2:       /${E.wisp2}/`);
  console.log(`   UV copy #2:    /${E.uv}/`);
  console.log(`   UV copy #1:    /${E.staticUv}/`);
  console.log(`   Trojans UV:    /${E.trojans}/`);
  console.log(`   uv.js:         /${E.uvJs}.js`);
  console.log(`   uv-sw.js:      /${E.uvSwJs}.js`);
  console.log(`   register-sw.js:/${E.registerSw}.js`);
  console.log(`   SW bootstrap:  /${E.sw}.js\n`);
  console.log('📡 Fixed mounts:');
  console.log('   /storage/              (game files + images)');
  console.log('   /alloy/                (Alloy)');
  console.log('   /firefox-wasm/         (Firefox WASM VM)');
  console.log('   /api/websocket*        (WISP)');
  console.log('   /api/edge/             (Bare)');
  console.log('   /afsd123k2/*           (Scramjet proxy prefix — unchanged)\n');
  console.log('🎵 Music:');
  console.log('   /api/music/search      (iTunes)');
  console.log('   /api/music/play/:id    (resolve to audio URL)');
  console.log('   /api/music/media/:tok  (Range-aware stream)');
  console.log('   /api/cover/:token      (image proxy)\n');
  console.log('🖥️  VM:');
  console.log('   Splash:    /firefox-wasm/index.html');
  console.log('   Sessions:  GET  /api/vm/status');
  console.log('   Heartbeat: POST /api/vm/heartbeat\n');
  console.log('🤖 AI:');
  console.log(`   Provider:  Groq`);
  console.log(`   Models:    openai/gpt-oss-120b, openai/gpt-oss-20b`);
  console.log(`   Vision:    meta-llama/llama-4-scout-17b-16e-instruct\n`);
  console.log('🩺 Unified Monitor:');
  console.log(`   Platform:      ${monitor.status().platform}`);
  console.log(`   Memory limit:  ${monitor.status().config.maxMemoryMB}MB`);
  console.log(`   Disk limit:    ${monitor.status().config.maxDiskPercent}%`);
  console.log(`   Tick every:    ${monitor.status().config.tickIntervalMs}ms`);
  console.log(`   Resource every: ${monitor.status().config.resourceEveryNTick} ticks`);
  console.log(`   Status:        GET /api/monitor\n`);
});