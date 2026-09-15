/**
 * Trojans Proxy Hub — Settings Module
 * Loaded by /index.html via <script src="/storage/js/settings.js">
 *
 * Responsibilities:
 *  - Persist user preferences (theme, background, search engine, tab cloak)
 *  - Inject a floating settings button + panel
 *  - Sync with /api/user/settings so prefs survive across devices
 *  - Apply theme variables to CSS custom properties
 */

(function () {
  'use strict';

  // ----------------------------------------------------------
  //  Defaults
  // ----------------------------------------------------------
  const DEFAULTS = {
    theme: 'midnight',          // midnight | aurora | cherry | forest
    searchEngine: 'duckduckgo', // duckduckgo | google | bing | brave
    tabTitle: 'New Tab',        // tab cloaker
    tabIcon: '/logo.png',       // favicon cloaker
    particles: true,            // animated background
    godRays: true,              // sun ray effect
    showPins: true,             // pinned shortcuts
    showTime: true,             // clock
    autoFocusSearch: true,      // focus search on load
  };

  const SEARCH_ENGINES = {
    duckduckgo: 'https://duckduckgo.com/?q=%s',
    google:     'https://www.google.com/search?q=%s',
    bing:       'https://www.bing.com/search?q=%s',
    brave:      'https://search.brave.com/search?q=%s',
  };

  const THEMES = {
    midnight: { bg: '#0a1d37', accent: '#64a6e0', text: '#ffffff' },
    aurora:   { bg: '#0d2818', accent: '#4ade80', text: '#ecfdf5' },
    cherry:   { bg: '#2a0a1a', accent: '#f472b6', text: '#fdf2f8' },
    forest:   { bg: '#1a2e1a', accent: '#84cc16', text: '#f7fee7' },
  };

  // ----------------------------------------------------------
  //  Load / save
  // ----------------------------------------------------------
  let settings = { ...DEFAULTS };

  function loadLocal() {
    try {
      const raw = localStorage.getItem('trojans_settings');
      if (raw) Object.assign(settings, JSON.parse(raw));
    } catch (e) {
      console.warn('[Trojans] Failed to read settings:', e);
    }
  }

  function saveLocal() {
    try {
      localStorage.setItem('trojans_settings', JSON.stringify(settings));
    } catch (e) {
      console.warn('[Trojans] Failed to save settings:', e);
    }
  }

  async function syncFromApi() {
    try {
      const res = await fetch('/api/user/settings');
      if (!res.ok) return;
      const api = await res.json();
      // Merge only the keys we care about
      Object.keys(DEFAULTS).forEach((k) => {
        if (api[k] !== undefined) settings[k] = api[k];
      });
      saveLocal();
      apply();
    } catch (e) {
      // API offline — cached settings are fine
    }
  }

  async function syncToApi() {
    try {
      await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch (e) {
      // Silent — localStorage already has it
    }
  }

  // ----------------------------------------------------------
  //  Apply settings to the page
  // ----------------------------------------------------------
  function applyTheme() {
    const theme = THEMES[settings.theme] || THEMES.midnight;
    const root = document.documentElement;
    root.style.setProperty('--trojans-bg', theme.bg);
    root.style.setProperty('--trojans-accent', theme.accent);
    root.style.setProperty('--trojans-text', theme.text);

    document.body.style.backgroundColor = theme.bg;
    document.body.style.color = theme.text;
  }

  function applySearchEngine() {
    const input = document.getElementById('uv-search-engine');
    if (input) input.value = SEARCH_ENGINES[settings.searchEngine] || SEARCH_ENGINES.duckduckgo;
  }

  function applyTabCloak() {
    if (settings.tabTitle) document.title = settings.tabTitle;
    if (settings.tabIcon) {
      let favicon = document.querySelector('link[rel="icon"]');
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = settings.tabIcon;
    }
  }

  function applyVisibility() {
    const rays = document.querySelector('.god-rays');
    if (rays) rays.style.display = settings.godRays ? '' : 'none';

    const pins = document.querySelector('.pinned-icons');
    if (pins) pins.style.display = settings.showPins ? 'flex' : 'none';

    const time = document.getElementById('time');
    if (time) time.style.display = settings.showTime ? 'block' : 'none';
  }

  function applyAutoFocus() {
    if (!settings.autoFocusSearch) return;
    const input = document.getElementById('uv-address');
    if (input && !input.value) {
      setTimeout(() => input.focus(), 100);
    }
  }

  function apply() {
    applyTheme();
    applySearchEngine();
    applyTabCloak();
    applyVisibility();
    applyAutoFocus();
  }

  // ----------------------------------------------------------
  //  Settings panel UI
  // ----------------------------------------------------------
  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'trojans-settings-panel';
    panel.innerHTML = `
      <style>
        #trojans-settings-btn {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          backdrop-filter: blur(8px);
          color: #fff;
          font-size: 20px;
          cursor: pointer;
          display: grid;
          place-items: center;
          z-index: 9998;
          transition: transform 0.2s ease, background 0.2s ease;
        }
        #trojans-settings-btn:hover { transform: scale(1.1); background: rgba(255,255,255,0.2); }

        #trojans-settings-panel .tp-body {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(0.95);
          width: 380px;
          max-height: 85vh;
          overflow-y: auto;
          background: #0a1d37;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 16px;
          padding: 24px;
          z-index: 9999;
          color: #fff;
          font-family: 'Outfit', system-ui, sans-serif;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        #trojans-settings-panel.open .tp-body {
          opacity: 1;
          pointer-events: auto;
          transform: translate(-50%, -50%) scale(1);
        }
        #trojans-settings-panel .tp-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          z-index: 9997;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }
        #trojans-settings-panel.open .tp-backdrop {
          opacity: 1;
          pointer-events: auto;
        }
        .tp-title { font-size: 1.25rem; font-weight: 700; margin: 0 0 20px; letter-spacing: 0.5px; }
        .tp-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .tp-row:last-child { border-bottom: none; }
        .tp-label { font-size: 0.9rem; opacity: 0.9; }
        .tp-select, .tp-input {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          padding: 6px 10px;
          border-radius: 8px;
          font-family: inherit;
          font-size: 0.85rem;
          outline: none;
          min-width: 140px;
        }
        .tp-select:focus, .tp-input:focus { border-color: rgba(255,255,255,0.4); }
        .tp-toggle {
          position: relative;
          width: 42px;
          height: 22px;
          background: rgba(255,255,255,0.15);
          border-radius: 999px;
          cursor: pointer;
          transition: background 0.2s ease;
          border: none;
        }
        .tp-toggle.on { background: #64a6e0; }
        .tp-toggle::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.2s ease;
        }
        .tp-toggle.on::after { transform: translateX(20px); }
        .tp-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
        .tp-btn {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.05);
          color: #fff;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.85rem;
          transition: background 0.2s ease;
        }
        .tp-btn:hover { background: rgba(255,255,255,0.15); }
        .tp-btn.primary { background: #64a6e0; border-color: #64a6e0; color: #001b33; font-weight: 600; }
        .tp-btn.primary:hover { background: #7bb8ec; }
        .tp-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          font-size: 20px;
        }
        .tp-close:hover { color: #fff; }
      </style>

      <div class="tp-backdrop"></div>
      <div class="tp-body">
        <button class="tp-close" aria-label="Close">&times;</button>
        <h2 class="tp-title">Settings</h2>

        <div class="tp-row">
          <span class="tp-label">Theme</span>
          <select class="tp-select" data-key="theme">
            <option value="midnight">Midnight</option>
            <option value="aurora">Aurora</option>
            <option value="cherry">Cherry</option>
            <option value="forest">Forest</option>
          </select>
        </div>

        <div class="tp-row">
          <span class="tp-label">Search Engine</span>
          <select class="tp-select" data-key="searchEngine">
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="google">Google</option>
            <option value="bing">Bing</option>
            <option value="brave">Brave</option>
          </select>
        </div>

        <div class="tp-row">
          <span class="tp-label">Tab Title</span>
          <input class="tp-input" type="text" data-key="tabTitle" placeholder="New Tab" />
        </div>

        <div class="tp-row">
          <span class="tp-label">God Rays</span>
          <button class="tp-toggle" data-key="godRays" data-type="bool"></button>
        </div>

        <div class="tp-row">
          <span class="tp-label">Pinned Shortcuts</span>
          <button class="tp-toggle" data-key="showPins" data-type="bool"></button>
        </div>

        <div class="tp-row">
          <span class="tp-label">Clock</span>
          <button class="tp-toggle" data-key="showTime" data-type="bool"></button>
        </div>

        <div class="tp-row">
          <span class="tp-label">Auto-focus Search</span>
          <button class="tp-toggle" data-key="autoFocusSearch" data-type="bool"></button>
        </div>

        <div class="tp-actions">
          <button class="tp-btn" data-action="reset">Reset</button>
          <button class="tp-btn primary" data-action="save">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Floating trigger button
    const btn = document.createElement('button');
    btn.id = 'trojans-settings-btn';
    btn.setAttribute('aria-label', 'Open Settings');
    btn.innerHTML = '&#9881;';
    document.body.appendChild(btn);

    return panel;
  }

  function wirePanel(panel) {
    const trigger = document.getElementById('trojans-settings-btn');
    const backdrop = panel.querySelector('.tp-backdrop');
    const closeBtn = panel.querySelector('.tp-close');

    const open = () => {
      panel.classList.add('open');
      // Hydrate current values into the panel
      panel.querySelectorAll('[data-key]').forEach((el) => {
        const key = el.dataset.key;
        if (el.dataset.type === 'bool') {
          el.classList.toggle('on', !!settings[key]);
        } else {
          el.value = settings[key] ?? '';
        }
      });
    };

    const close = () => panel.classList.remove('open');

    trigger.addEventListener('click', open);
    backdrop.addEventListener('click', close);
    closeBtn.addEventListener('click', close);

    // Toggles
    panel.querySelectorAll('.tp-toggle').forEach((el) => {
      el.addEventListener('click', () => {
        const key = el.dataset.key;
        settings[key] = !settings[key];
        el.classList.toggle('on', settings[key]);
      });
    });

    // Save / Reset
    panel.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;

        if (action === 'reset') {
          settings = { ...DEFAULTS };
          saveLocal();
          apply();
          open(); // re-hydrate panel
          syncToApi();
          return;
        }

        if (action === 'save') {
          // Pull values from inputs
          panel.querySelectorAll('[data-key]:not([data-type="bool"])').forEach((el) => {
            settings[el.dataset.key] = el.value;
          });
          saveLocal();
          apply();
          syncToApi();
          close();
        }
      });
    });
  }

  // ----------------------------------------------------------
  //  Boot
  // ----------------------------------------------------------
  function init() {
    loadLocal();
    apply();

    const panel = buildPanel();
    wirePanel(panel);

    // Sync with API in the background (non-blocking)
    syncFromApi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();