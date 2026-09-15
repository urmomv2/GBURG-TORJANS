// server/media-proxy.js
// Audio streaming proxy with Range support + host whitelisting.

const { Readable } = require('stream');

const KEY = 'trojans!';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const ALLOW_HOST = [
  /(^|\.)mzstatic\.com$/i,
  /(^|\.)itunes\.apple\.com$/i,
  /(^|\.)audio-ssl\.itunes\.apple\.com$/i,
  /(^|\.)sndcdn\.com$/i,
  /(^|\.)soundcloud\.com$/i,
  /(^|\.)scdn\.co$/i,
  /(^|\.)spotifycdn\.com$/i,
  /(^|\.)ytimg\.com$/i,
];

function encodeMediaUrl(url) {
  const e = encodeURIComponent(String(url || ''));
  let x = '';
  for (let i = 0; i < e.length; i++) {
    x += String.fromCharCode(e.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
  }
  return Buffer.from(x, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeMediaUrl(token) {
  try {
    let b64 = String(token || '').replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const raw = Buffer.from(b64, 'base64').toString('binary');
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      out += String.fromCharCode(raw.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
    }
    const url = decodeURIComponent(out);
    if (!/^https:\/\//i.test(url)) return null;
    return url;
  } catch {
    return null;
  }
}

function isAllowedMediaHost(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (u.username || u.password) return false;
    return ALLOW_HOST.some((re) => re.test(h));
  } catch {
    return false;
  }
}

async function proxyMedia(req, res) {
  const token = String(req.params.token || '').split('.')[0];
  const target = decodeMediaUrl(token);

  if (!target || !isAllowedMediaHost(target)) {
    return res.status(404).end();
  }

  const headers = {
    'User-Agent': UA,
    Accept: '*/*',
    'Accept-Encoding': 'identity',
  };
  if (req.headers.range) headers.Range = req.headers.range;

  try {
    headers.Referer = new URL(target).origin + '/';
  } catch {}

  let upstream;
  try {
    upstream = await fetch(target, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    return res.status(502).end();
  }

  if (!upstream.ok && upstream.status !== 206) {
    return res.status(upstream.status === 404 ? 404 : 502).end();
  }

  const finalUrl = String(upstream.url || target);
  if (!isAllowedMediaHost(finalUrl)) {
    try {
      upstream.body?.cancel?.();
    } catch {}
    return res.status(403).end();
  }

  res.status(upstream.status);

  const pass = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'cache-control',
    'last-modified',
    'etag',
  ];
  for (const k of pass) {
    const v = upstream.headers.get(k);
    if (v) res.setHeader(k, v);
  }

  if (!res.getHeader('content-type')) {
    res.setHeader('Content-Type', 'audio/mpeg');
  }
  res.setHeader(
    'Cache-Control',
    res.getHeader('cache-control') || 'private, max-age=3600',
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!upstream.body) return res.end();

  const nodeStream = Readable.fromWeb(upstream.body);
  nodeStream.pipe(res);

  req.on('close', () => {
    try {
      nodeStream.destroy();
    } catch {}
  });
}

module.exports = {
  encodeMediaUrl,
  decodeMediaUrl,
  isAllowedMediaHost,
  proxyMedia,
};