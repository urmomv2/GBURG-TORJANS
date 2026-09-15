// server/vm-sessions.js
// ============================================================
//  Trojans Proxy Hub — VM Session Tracker
// ============================================================
//  Tracks how many people are actively using the Firefox WASM VM.
//
//  No auth required — the VM is public. Sessions are keyed by a
//  random UUID the browser generates on first heartbeat. Sessions
//  expire after 45 seconds of silence.
//
//  State lives in memory. Optionally persists a rolling 7-day
//  aggregate to server/data/vm_usage.json.
// ============================================================

const fs = require('fs');
const path = require('path');

const STALE_MS = 45_000;              // session considered dead after 45s
const MAX_ACTIVE = 500;               // cap in-memory sessions
const USAGE_FILE = path.join(__dirname, 'data', 'vm_usage.json');
const USAGE_RETENTION_DAYS = 7;

// ---- In-memory active sessions ----
// Map<sessionId, { startedAt, lastSeen, ip }>
const active = new Map();
let lastPrune = 0;

// ---- Per-IP rate limiter ----
const rateMap = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120;                 // 2 heartbeats/sec per IP is plenty

function rateCheck(ip) {
  const now = Date.now();
  const hits = (rateMap.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) return false;
  hits.push(now);
  rateMap.set(ip, hits);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of rateMap.entries()) {
    const fresh = hits.filter((t) => now - t < RATE_WINDOW_MS);
    if (fresh.length === 0) rateMap.delete(ip);
    else rateMap.set(ip, fresh);
  }
}, 60_000).unref?.();

// ---- Usage aggregate ----
let usage = { days: {} };

function loadUsage() {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      usage = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
      if (!usage.days) usage.days = {};
    }
  } catch {
    usage = { days: {} };
  }
}

function saveUsage() {
  try {
    // Prune old days
    const cutoff = Date.now() - USAGE_RETENTION_DAYS * 86_400_000;
    for (const [day, entry] of Object.entries(usage.days)) {
      const t = entry?.firstSeenAt || 0;
      if (t && t < cutoff) delete usage.days[day];
    }
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));
  } catch {}
}

function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function recordLaunch() {
  const day = dayKey();
  const entry = usage.days[day] || { launches: 0, firstSeenAt: Date.now() };
  entry.launches += 1;
  usage.days[day] = entry;
  saveUsage();
}

loadUsage();

// ---- Helpers ----
function pruneActive(force = false) {
  const now = Date.now();
  if (!force && now - lastPrune < 10_000) return;
  lastPrune = now;

  for (const [id, row] of active) {
    if (now - row.lastSeen > STALE_MS) active.delete(id);
  }

  if (active.size <= MAX_ACTIVE) return;

  // Evict oldest
  const sorted = [...active.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
  const drop = active.size - MAX_ACTIVE;
  for (let i = 0; i < drop; i++) active.delete(sorted[i][0]);
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}

// ---- Endpoints ----
function heartbeat(req, res) {
  const ip = getClientIp(req);
  if (!rateCheck(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  pruneActive();

  let sessionId =
    typeof req.body?.sessionId === 'string'
      ? req.body.sessionId.slice(0, 36)
      : '';

  const now = Date.now();

  if (sessionId && active.has(sessionId)) {
    const row = active.get(sessionId);
    row.lastSeen = now;
    return res.json({ ok: true, sessionId, active: active.size });
  }

  // New session
  sessionId = sessionId || require('crypto').randomUUID();
  active.set(sessionId, {
    startedAt: now,
    lastSeen: now,
    ip,
  });
  recordLaunch();

  res.json({ ok: true, sessionId, active: active.size });
}

function end(req, res) {
  const sessionId =
    typeof req.body?.sessionId === 'string'
      ? req.body.sessionId.slice(0, 36)
      : '';
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
  active.delete(sessionId);
  res.json({ ok: true });
}

function status(req, res) {
  pruneActive(true);

  const now = Date.now();
  const sessions = [...active.entries()]
    .map(([id, row]) => ({
      sessionId: id,
      startedAt: row.startedAt,
      lastSeen: row.lastSeen,
      durationMs: now - row.startedAt,
    }))
    .sort((a, b) => b.lastSeen - a.lastSeen);

  res.json({
    active: sessions.length,
    sessions: sessions.slice(0, 100),
    today: {
      day: dayKey(),
      launches: usage.days[dayKey()]?.launches || 0,
    },
    updatedAt: now,
  });
}

module.exports = { heartbeat, end, status };