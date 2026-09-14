// public/1k123.js
// Trojans Proxy Hub — Scramjet service worker bootstrap
// Loads sj.all.js (Scramjet core), handles Rivet routing, and proxies
// all requests under /{prefix}/ through the engine.

// ---- Firefox SAB workaround ----
// Firefox reports crossOriginIsolated=false even when COOP/COEP are set,
// which breaks Scramjet's WASM. Force it true so the engine can boot.
if (navigator.userAgent.includes('Firefox')) {
  Object.defineProperty(globalThis, 'crossOriginIsolated', {
    value: true,
    writable: false,
  });
}

// ---- Resolve our own base path ----
// _base is the directory where this SW lives (usually "/").
// _p points at /q9vx/ (Scramjet core), _f is the bundle filename.
const _base = self.location.pathname.replace(/[^/]*$/, '');
const _p = _base + ['q', '9vx/'].join('');
const _f = ['sj', '.all', '.js'].join('');
const _v = ['dl', '13'].join(''); // cache-bust version

// ---- Import Scramjet core ----
try {
  importScripts(_p + _f + '?v=' + _v);
} catch (e) {
  // Swallow — fallback path may still work
}

// ---- Import Rivet router (optional) ----
// Rivet lets multiple proxy engines coexist under one SW.
try {
  importScripts(_base + 'b/rivet/router.js?v=' + _v);
} catch (e) {
  // Rivet is optional
}

// ---- Rivet fetch handler ----
function handleRivet(event) {
  const router = self.$rivetRouter;
  if (!router || typeof router.shouldRoute !== 'function') return false;
  try {
    if (!router.shouldRoute(event)) return false;
    event.respondWith(router.route(event));
    return true;
  } catch (e) {
    return false;
  }
}

// ---- Boot the Scramjet engine ----
// $voltEdgeLoadWorker is the global export from sj.all.js
// VoltEdgeServiceWorker is the class we instantiate.
const _lw = ['$', 'volt', 'edge', 'Load', 'Worker'].join('');
const _sw = ['Volt', 'edge', 'Service', 'Worker'].join('');
const _boot = self[_lw];

if (typeof _boot !== 'function') {
  // Scramjet didn't load — register a passthrough SW so the page
  // doesn't break completely.
  self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });

  self.addEventListener('fetch', (event) => {
    if (handleRivet(event)) return;
    event.respondWith(fetch(event.request));
  });
} else {
  // ---- Scramjet is available — boot the full engine ----
  const _exports = _boot();
  const _engine = new _exports[_sw]();

  // Prefix that proxied URLs are served under
  const _pref = _base + ['afs', 'd123', 'k2/'].join('');

  // Hydration state for the config (loaded from IndexedDB)
  let _hydrated = false;
  let _configPromise = null;

  self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });

  // ---- Which requests hit the app shell (not the proxy) ----
  // These bypass the engine so the frontend loads even if Scramjet is slow.
  function isAppShellRequest(request, url) {
    if (url.origin !== self.location.origin) return false;
    const path = url.pathname;

    // Never intercept the proxy prefix itself
    if (path.indexOf(_pref) === 0) return false;

    // App shell files
    if (
      path === _base ||
      path === _base + 'index.html' ||
      path === _base + 'index.svg' ||
      path === _base + 'new.svg' ||
      path === _base + '1k123.js'
    ) return true;

    // Static assets
    if (path.indexOf(_base + 'assets/') === 0) return true;

    // Scramjet core (except WASM, which the engine needs to fetch itself)
    if (path.indexOf(_base + 'q9vx/') === 0) {
      if (path.indexOf('.wasm') !== -1) return false;
      return true;
    }

    // Transports
    if (path.indexOf(_base + 'm4thx/') === 0) return true;
    if (path.indexOf(_base + 'e7px/') === 0) return true;
    if (path.indexOf(_base + 'l9cx/') === 0) return true;

    return false;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---- Config validation ----
  // A config is "ready" when it has a prefix and all three file paths.
  function configReady(c) {
    return !!(
      c &&
      c.prefix &&
      c.files &&
      c.files.wasm &&
      c.files.all &&
      c.files.sync
    );
  }

  // ---- Try to hydrate the engine's config from IndexedDB ----
  async function hydrateFromIdb() {
    if (configReady(_engine.config)) {
      try {
        await _engine.setConfig(_engine.config);
        _hydrated = true;
        return true;
      } catch (e) {}
    }

    const previous = configReady(_engine.config) ? _engine.config : null;

    // Poll loadConfig up to 40 times (2 seconds total)
    for (let i = 0; i < 40; i++) {
      try {
        if (!configReady(_engine.config)) {
          _engine.config = undefined;
        }
        await _engine.loadConfig();
        if (configReady(_engine.config)) {
          _hydrated = true;
          return true;
        }
      } catch (e) {}
      await delay(50);
    }

    // Restore previous config as a last resort
    if (previous) {
      try {
        await _engine.setConfig(previous);
        _hydrated = true;
        return true;
      } catch (e) {}
    }
    return false;
  }

  // ---- Ensure config is loaded (deduped) ----
  async function ensureConfig() {
    if (_hydrated && configReady(_engine.config)) return true;
    if (_configPromise) return _configPromise;

    _configPromise = hydrateFromIdb().finally(() => {
      _configPromise = null;
    });
    return _configPromise;
  }

  // ---- Apply a config sent via postMessage ----
  async function applyConfigMessage(data) {
    if (data.config && configReady(data.config)) {
      try {
        await _engine.setConfig(data.config);
        _hydrated = true;
        return;
      } catch (e) {}
    }
    if (configReady(_engine.config)) {
      try {
        await _engine.setConfig(_engine.config);
        _hydrated = true;
        return;
      } catch (e) {}
    }
    await ensureConfig();
  }

  // ---- Main request handler ----
  async function handleRequest(event) {
    let url;
    try {
      url = new URL(event.request.url);
    } catch (e) {
      return fetch(event.request);
    }

    const ready = await ensureConfig();
    if (!ready || !configReady(_engine.config)) {
      if (url.pathname.indexOf(_pref) === 0) {
        return new Response('Proxy engine not ready', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      }
      try {
        return await fetch(event.request);
      } catch (e) {
        return new Response('Network error', { status: 502 });
      }
    }

    try {
      if (_engine.route(event)) {
        return await _engine.fetch(event);
      }
    } catch (e) {
      if (url.pathname.indexOf(_pref) === 0) {
        return new Response('Proxy fetch failed', { status: 502 });
      }
    }

    try {
      return await fetch(event.request);
    } catch (e) {
      return new Response('Network error', { status: 502 });
    }
  }

  // ---- Fetch event — only proxy requests under our prefix ----
  self.addEventListener('fetch', (event) => {
    if (handleRivet(event)) return;

    try {
      const url = new URL(event.request.url);
      if (
        url.origin !== self.location.origin ||
        url.pathname.indexOf(_pref) !== 0
      ) {
        return;
      }
    } catch (e) {
      return;
    }

    event.respondWith(handleRequest(event));
  });

  // ---- Playground support (live code preview inside Scramjet) ----
  let playgroundData;
  self.addEventListener('message', (msg) => {
    const data = msg.data;
    if (!data) return;

    if (data.type === 'playgroundData') {
      playgroundData = data;
    }

    // Load config sent from the main thread
    if (data[['volt', 'edge', '$type'].join('')] === 'loadConfig') {
      const p = applyConfigMessage(data);
      if (typeof msg.waitUntil === 'function') {
        try {
          msg.waitUntil(p);
        } catch (e) {}
      }
    }
  });

  // ---- Serve playground virtual files ----
  _engine.addEventListener('request', (e) => {
    if (playgroundData && e.url.href.indexOf(playgroundData.origin) === 0) {
      const headers = {};
      const origin = playgroundData.origin;

      if (e.url.href === origin + '/') {
        headers['content-type'] = 'text/html';
        e.response = new Response(playgroundData.html, { headers });
      } else if (e.url.href === origin + '/style.css') {
        headers['content-type'] = 'text/css';
        e.response = new Response(playgroundData.css, { headers });
      } else if (e.url.href === origin + '/script.js') {
        headers['content-type'] = 'application/javascript';
        e.response = new Response(playgroundData.js, { headers });
      } else {
        e.response = new Response('empty response', { headers });
      }

      e.response.rawHeaders = headers;
      e.response.rawResponse = {
        body: e.response.body,
        headers,
        status: e.response.status,
        statusText: e.response.statusText,
      };
      e.response.finalURL = e.url.toString();
    }
  });
}