#!/usr/bin/env node
// scripts/vendor-firefox-wasm.js
// Downloads HeyPuter/firefox-wasm, patches the WISP endpoint to point at
// Trojans, applies a custom shell, and installs into public/firefox-wasm/.

import {
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  cpSync,
} from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dest = path.join(root, 'public', 'firefox-wasm');
const templates = path.join(__dirname, 'templates');
const tag = process.env.FIREFOX_WASM_TAG || 'v0.0.1';

// Where the VM sends its WISP WebSocket traffic.
// Trojans serves WISP at /api/websocket/ — this replaces Puter's hosted relay.
const WISP_PATH = process.env.TROJANS_WISP_PATH || '/api/websocket/';

async function download(url, out) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Trojans-firefox-wasm-vendor' },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(out));
}

async function resolveChromeDemoUrl() {
  if (process.env.FIREFOX_WASM_URL) return process.env.FIREFOX_WASM_URL;

  const api = `https://api.github.com/repos/HeyPuter/firefox-wasm/releases/tags/${tag}`;
  try {
    const res = await fetch(api, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Trojans-firefox-wasm-vendor',
      },
    });
    if (res.ok) {
      const data = await res.json();
      const asset = (data.assets || []).find(
        (a) =>
          /^chrome-demo.*\.tar\.gz$/i.test(a.name) ||
          /^chrome-demo.*\.tgz$/i.test(a.name),
      );
      if (asset?.browser_download_url) {
        console.log('📦 Resolved release asset:', asset.name);
        return asset.browser_download_url;
      }
    } else {
      console.warn('⚠️  GitHub API', res.status, '- falling back to known filenames');
    }
  } catch (err) {
    console.warn('⚠️  GitHub API lookup failed:', err.message);
  }

  const candidates = [
    `https://github.com/HeyPuter/firefox-wasm/releases/download/${tag}/chrome-demo-${tag}.tar.gz`,
    `https://github.com/HeyPuter/firefox-wasm/releases/download/${tag}/chrome-demo.tar.gz`,
  ];
  for (const u of candidates) {
    const head = await fetch(u, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'Trojans-firefox-wasm-vendor' },
    });
    if (head.ok) return u;
  }
  return candidates[0];
}

function findJs(dir) {
  const assets = path.join(dir, 'assets');
  if (!existsSync(assets)) return null;
  const name = readdirSync(assets).find(
    (f) => f.startsWith('index-') && f.endsWith('.js'),
  );
  return name ? path.join(assets, name) : null;
}

function patchJs(jsPath) {
  let s = readFileSync(jsPath, 'utf8');
  const before = s;

  // ---- 1. Patch the WISP bootstrap ----
  // The upstream demo calls out to Puter's hosted relay. We replace the
  // entire bootstrap with a version that points at Trojans' own WISP.
  // Match patterns we've seen across releases:
  const patterns = [
    // Original Puter bootstrap
    /de=new URL\("wisp\/",location\.href\);de\.protocol=location\.protocol==="https:"\?"wss:":"ws:";let y=de\.href;const F=!0;F&&await fetch\("https:\/\/sensible-ship-8305\.puter\.work\/"\)\.then\(r=>r\.text\(\)\)\.then\(r=>\{y=r\.trim\(\)\}\);/,
    // Later versions with the same shape but different endpoint
    /de=new URL\("wisp\/",location\.href\)[\s\S]{0,200}?y=r\.trim\(\)\}\);/,
  ];

  const replacement =
    `de=new URL(${JSON.stringify(WISP_PATH)},location.origin);` +
    `de.protocol=location.protocol==="https:"?"wss:":"ws:";` +
    `let y=de.href;const F=!1;`;

  let patched = false;
  for (const rx of patterns) {
    if (rx.test(s)) {
      s = s.replace(rx, replacement);
      console.log(`🔧 Patched WISP bootstrap → ${WISP_PATH}`);
      patched = true;
      break;
    }
  }

  if (!patched) {
    // Fallback — try the legacy UK/alt endpoints from older builds
    const legacy = [
      /de=new URL\("\/api\/websocket-1\/",location\.origin\);de\.protocol=location\.protocol==="https:"\?"wss:":"ws:";let y=de\.href;const F=!1;/,
      /de=new URL\("\/api\/websocket-3\/",location\.origin\);de\.protocol=location\.protocol==="https:"\?"wss:":"ws:";let y=de\.href;const F=!1;/,
      /de=new URL\("\/api\/alt-wisp-1\/",location\.origin\);de\.protocol=location\.protocol==="https:"\?"wss:":"ws:";let y=de\.href;const F=!1;/,
      /de=new URL\("\/api\/alt-wisp-3\/",location\.origin\);de\.protocol=location\.protocol==="https:"\?"wss:":"ws:";let y=de\.href;const F=!1;/,
    ];
    for (const rx of legacy) {
      if (rx.test(s)) {
        s = s.replace(rx, replacement);
        console.log(`🔧 Migrated legacy WISP bootstrap → ${WISP_PATH}`);
        patched = true;
        break;
      }
    }
  }

  if (!patched) {
    // Only warn — don't hard-fail. The user can still try it if their build differs.
    console.warn('⚠️  Could not locate Puter WISP bootstrap to patch.');
    console.warn('    The VM may use the default Puter relay. Check assets/index-*.js');
  }

  // ---- 2. Patch the default "open" URL ----
  const oldOpen =
    'A.evalChrome("openTrustedLinkIn(\'https://developer.puter.com/\', \'current\'); \'ok\'")';
  const newOpen =
    'A.evalChrome("openTrustedLinkIn(\'"+location.origin+"/firefox-wasm/thanks.html\', \'current\'); \'ok\'")';
  if (s.includes(oldOpen)) {
    s = s.replace(oldOpen, newOpen);
    console.log('🔧 Patched default tab → thanks.html');
  }

  // ---- 3. Patch the default bookmark ----
  const oldBm =
    'title:"Puter Developer",url:"https://developer.puter.com/",guid:"chromedemo02"';
  const newBm =
    'title:"Trojans VM",url:location.origin+"/firefox-wasm/thanks.html",guid:"chromedemo02"';
  if (s.includes(oldBm)) {
    s = s.replace(oldBm, newBm);
    console.log('🔧 Patched bookmark → Trojans VM');
  }

  if (s === before) {
    console.warn('⚠️  No patches applied — the release layout may have changed.');
  } else {
    writeFileSync(jsPath, s);
    console.log('✅ Wrote patched bundle');
  }
}

function applyShell(dir) {
  const indexTpl = path.join(templates, 'firefox-wasm-index.html');
  const thanksTpl = path.join(templates, 'firefox-wasm-thanks.html');
  const cssTpl = path.join(templates, 'trojans-vm.css');

  if (existsSync(cssTpl)) {
    copyFileSync(cssTpl, path.join(dir, 'trojans-vm.css'));
  }

  if (existsSync(indexTpl)) {
    let html = readFileSync(indexTpl, 'utf8');
    const jsName = readdirSync(path.join(dir, 'assets')).find(
      (f) => f.startsWith('index-') && f.endsWith('.js'),
    );
    if (jsName) {
      html = html.replace(/\.\/assets\/index-[^"]+\.js/, `./assets/${jsName}`);
    }
    writeFileSync(path.join(dir, 'index.html'), html);
    console.log('🔧 Applied custom index.html');
  }

  if (existsSync(thanksTpl)) {
    copyFileSync(thanksTpl, path.join(dir, 'thanks.html'));
    console.log('🔧 Applied thanks.html');
  }
}

function syncToDist(dir) {
  const distRoot = path.join(root, 'dist');
  if (!existsSync(distRoot)) return;
  const distDest = path.join(distRoot, 'firefox-wasm');
  rmSync(distDest, { recursive: true, force: true });
  mkdirSync(path.dirname(distDest), { recursive: true });
  cpSync(dir, distDest, { recursive: true });
  console.log('📁 Synced to', distDest);
}

function assertBinaries(dir) {
  const needed = ['gecko.wasm.zst', 'chrome-assets.tar.zst', 'index.html'];
  const missing = needed.filter((f) => !existsSync(path.join(dir, f)));
  if (missing.length) {
    throw new Error(`Missing after vendor: ${missing.join(', ')}`);
  }
  console.log('✅ Binaries present:', needed.join(', '));
}

async function main() {
  const url = await resolveChromeDemoUrl();
  const tmp = path.join(root, '.tmp-firefox-wasm');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });

  const tarball = path.join(tmp, 'chrome-demo.tar.gz');
  console.log('📥 Downloading', url);
  await download(url, tarball);

  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  console.log('📦 Extracting…');
  execFileSync('tar', ['-xzf', tarball, '-C', tmp], { stdio: 'inherit' });

  const candidates = [
    path.join(tmp, 'dist'),
    path.join(tmp, 'chrome-demo'),
    path.join(tmp, 'chrome-demo', 'dist'),
    path.join(tmp, `chrome-demo-${tag}`),
    path.join(tmp, `chrome-demo-${tag}`, 'dist'),
    tmp,
  ];
  const src = candidates.find(
    (p) =>
      existsSync(path.join(p, 'index.html')) &&
      existsSync(path.join(p, 'gecko.wasm.zst')),
  );
  if (!src) throw new Error('Could not locate chrome-demo files in tarball');
  console.log('📂 Extracted from', src);

  execFileSync('sh', ['-c', `cp -R "${src}/." "${dest}/"`], { stdio: 'inherit' });

  const jsPath = findJs(dest);
  if (!jsPath) throw new Error('demo JS not found');

  patchJs(jsPath);
  applyShell(dest);
  assertBinaries(dest);
  syncToDist(dest);

  rmSync(tmp, { recursive: true, force: true });
  console.log('');
  console.log('✅ Firefox WASM vendored to', dest);
  console.log('   WISP endpoint:', WISP_PATH);
  console.log('   Restart the server to pick up the new files.');
}

main().catch((err) => {
  console.error('❌ Vendor failed:', err);
  process.exit(1);
});