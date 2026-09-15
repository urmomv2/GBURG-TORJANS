// server/monitor.js
// ============================================================
//  Trojans Proxy Hub — Unified Monitor
// ============================================================
//  One system, one timer, one set of process handlers.
//
//  Every tick (default 1s):
//    • Self-pings /api/health → tracks uptime + latency
//
//  Every Nth tick (default 30th):
//    • Reads RSS memory → tracks memory pressure
//    • Reads disk usage → tracks disk pressure
//
//  If memory OR disk stays above the hard limit for N checks
//  in a row, the process exits → platform restarts fresh.
//
//  Public API:
//    monitor.start(httpServer, port)  — begins monitoring
//    monitor.stop()                    — stops monitoring
//    monitor.status()                  — returns all stats
//    monitor.getMemoryStats()          — current RSS/heap
//    monitor.getDiskStats(path)        — current disk state
// ============================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// ------------------------------------------------------------------
//  Platform detection
// ------------------------------------------------------------------
function detectPlatform() {
  if (process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID) return 'render';
  if (
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID
  ) return 'railway';
  if (process.env.FLY_APP_NAME) return 'fly';
  if (process.env.DYNO) return 'heroku';
  return 'local';
}

const PLATFORM = detectPlatform();

const PLATFORM_DEFAULTS = {
  render:  { maxMemoryMB: 480,  maxDiskPercent: 85 },
  railway: { maxMemoryMB: 480,  maxDiskPercent: 85 },
  fly:     { maxMemoryMB: 400,  maxDiskPercent: 85 },
  heroku:  { maxMemoryMB: 480,  maxDiskPercent: 85 },
  local:   { maxMemoryMB: 1024, maxDiskPercent: 85 },
};

const DEFAULTS = PLATFORM_DEFAULTS[PLATFORM] || PLATFORM_DEFAULTS.local;

// ------------------------------------------------------------------
//  Config — all overridable via env
// ------------------------------------------------------------------
const CFG = {
  enabled:            process.env.MONITOR_DISABLED !== 'true',
  tickIntervalMs:     parseInt(process.env.MONITOR_TICK_INTERVAL_MS || '1000', 10),
  resourceEveryNTick: parseInt(process.env.MONITOR_RESOURCE_EVERY_N || '30', 10),
  maxMemoryMB:        parseInt(process.env.MONITOR_MAX_MEMORY_MB || String(DEFAULTS.maxMemoryMB), 10),
  maxDiskPercent:     parseInt(process.env.MONITOR_MAX_DISK_PERCENT || String(DEFAULTS.maxDiskPercent), 10),
  minFreeDiskMB:      parseInt(process.env.MONITOR_MIN_FREE_DISK_MB || '100', 10),
  softThreshold:      parseFloat(process.env.MONITOR_SOFT_THRESHOLD || '0.85'),
  consecutiveBreach:  parseInt(process.env.MONITOR_CONSECUTIVE_BREACH || '2', 10),
  gracefulTimeoutMs:  parseInt(process.env.MONITOR_GRACEFUL_TIMEOUT_MS || '5000', 10),
  checkDiskPath:      process.env.MONITOR_DISK_PATH || path.join(__dirname, 'data'),
  logEveryNResources: parseInt(process.env.MONITOR_LOG_EVERY_N || '10', 10),
  healthUrl:          null, // set by start()
};

// ------------------------------------------------------------------
//  State
// ------------------------------------------------------------------
let httpServer = null;
let intervalHandle = null;
let tickCount = 0;
let resourceCheckCount = 0;
let shuttingDown = false;

const stats = {
  startedAt: Date.now(),
  pings: {
    total: 0,
    successful: 0,
    failed: 0,
    consecutiveFailures: 0,
    lastLatencyMs: null,
    latencySum: 0,
    latencyMin: Infinity,
    latencyMax: 0,
  },
  memory: { breaches: 0, lastCheck: null },
  disk:   { breaches: 0, lastCheck: null },
  resets: 0,
  status: 'unknown',
};

// ------------------------------------------------------------------
//  Memory reader
// ------------------------------------------------------------------
function getMemoryStats() {
  const m = process.memoryUsage();
  return {
    rssMB:      Math.round(m.rss / 1024 / 1024),
    heapUsedMB: Math.round(m.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(m.heapTotal / 1024 / 1024),
    externalMB: Math.round(m.external / 1024 / 1024),
  };
}

// ------------------------------------------------------------------
//  Disk reader — statfs with df fallback
// ------------------------------------------------------------------
async function getDiskStats(targetPath) {
  if (typeof fs.promises.statfs === 'function') {
    try {
      const s = await fs.promises.statfs(targetPath);
      const totalBytes = Number(s.bsize) * Number(s.blocks);
      const freeBytes  = Number(s.bsize) * Number(s.bfree);
      const usedBytes  = totalBytes - freeBytes;
      const usedPct    = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
      return {
        totalMB: Math.round(totalBytes / 1024 / 1024),
        freeMB:  Math.round(freeBytes / 1024 / 1024),
        usedPct: Number(usedPct.toFixed(1)),
      };
    } catch {}
  }

  try {
    const { execSync } = require('child_process');
    const out = execSync(`df -k "${targetPath}" 2>/dev/null || df -k .`, {
      encoding: 'utf8',
    });
    const lines = out.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      const totalKB = parseInt(parts[1], 10);
      const usedKB  = parseInt(parts[2], 10);
      const freeKB  = parseInt(parts[3], 10);
      const usedPct = totalKB > 0 ? (usedKB / totalKB) * 100 : 0;
      return {
        totalMB: Math.round(totalKB / 1024),
        freeMB:  Math.round(freeKB / 1024),
        usedPct: Number(usedPct.toFixed(1)),
      };
    }
  } catch {}

  return null;
}

// ------------------------------------------------------------------
//  Self-ping — check that the server is responsive
// ------------------------------------------------------------------
function selfPing(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Self-ping timeout')));
  });
}

// ------------------------------------------------------------------
//  Graceful shutdown
// ------------------------------------------------------------------
async function triggerReset(reason, details) {
  if (shuttingDown) return;
  shuttingDown = true;
  stats.resets++;

  console.error('');
  console.error('════════════════════════════════════════════════════════════');
  console.error('  ⚠️  MONITOR THRESHOLD EXCEEDED — INITIATING FULL RESET');
  console.error('════════════════════════════════════════════════════════════');
  console.error(`  Reason:    ${reason}`);
  console.error(`  Platform:  ${PLATFORM}`);
  console.error(`  Details:   ${JSON.stringify(details, null, 2)}`);
  console.error(`  Uptime:    ${Math.round(process.uptime())}s`);
  console.error(`  Pings:     ${stats.pings.successful}/${stats.pings.total} ok`);
  console.error('');
  console.error('  The platform will automatically start a fresh container.');
  console.error('  On Render / Railway this typically takes 5–30 seconds.');
  console.error('════════════════════════════════════════════════════════════');
  console.error('');

  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  if (httpServer && typeof httpServer.close === 'function') {
    try {
      httpServer.close(() => {
        console.error('  ✅ HTTP server closed gracefully');
      });
    } catch (err) {
      console.error('  ⚠️  HTTP close error:', err.message);
    }
  }

  const forceExit = setTimeout(() => {
    console.error('  ⏱️  Graceful timeout reached — forcing exit');
    process.exit(1);
  }, CFG.gracefulTimeoutMs);
  forceExit.unref?.();

  setTimeout(() => {
    process.exit(1);
  }, CFG.gracefulTimeoutMs + 100).unref?.();
}

// ------------------------------------------------------------------
//  Resource check — memory + disk
// ------------------------------------------------------------------
async function runResourceCheck() {
  resourceCheckCount++;

  // ---- Memory ----
  const mem = getMemoryStats();
  stats.memory.lastCheck = mem;

  const memHardLimit = CFG.maxMemoryMB;
  const memSoftLimit = Math.floor(memHardLimit * CFG.softThreshold);

  let memOver = false;
  let memSoft = false;

  if (mem.rssMB >= memHardLimit) {
    memOver = true;
    stats.memory.breaches++;
  } else if (mem.rssMB >= memSoftLimit) {
    memSoft = true;
    stats.memory.breaches = 0;
  } else {
    stats.memory.breaches = 0;
  }

  // ---- Disk ----
  const disk = await getDiskStats(CFG.checkDiskPath);
  let diskOver = false;
  let diskSoft = false;

  if (disk) {
    stats.disk.lastCheck = disk;

    if (disk.usedPct >= CFG.maxDiskPercent || disk.freeMB <= CFG.minFreeDiskMB) {
      diskOver = true;
      stats.disk.breaches++;
    } else if (disk.usedPct >= CFG.maxDiskPercent * CFG.softThreshold) {
      diskSoft = true;
      stats.disk.breaches = 0;
    } else {
      stats.disk.breaches = 0;
    }
  }

  // ---- Soft warnings ----
  if (memSoft && resourceCheckCount % CFG.logEveryNResources === 0) {
    console.warn(
      `⚠️  [Monitor] Memory nearing limit: ${mem.rssMB}MB / ${memHardLimit}MB ` +
      `(${Math.round((mem.rssMB / memHardLimit) * 100)}%)`,
    );
  }
  if (diskSoft && resourceCheckCount % CFG.logEveryNResources === 0) {
    console.warn(
      `⚠️  [Monitor] Disk nearing limit: ${disk.usedPct}% used ` +
      `(${disk.freeMB}MB free / ${disk.totalMB}MB total)`,
    );
  }

  // ---- Periodic status log ----
  if (
    resourceCheckCount % CFG.logEveryNResources === 0 &&
    !memOver &&
    !diskOver &&
    !memSoft &&
    !diskSoft
  ) {
    console.log(
      `📊 [Monitor] Mem ${mem.rssMB}MB/${memHardLimit}MB · ` +
      (disk ? `Disk ${disk.usedPct}%/${CFG.maxDiskPercent}%` : 'Disk n/a') +
      ` · pings ${stats.pings.successful}/${stats.pings.total} · ` +
      `uptime ${Math.round(process.uptime())}s`,
    );
  }

  // ---- Reset decisions ----
  if (stats.memory.breaches >= CFG.consecutiveBreach) {
    return triggerReset(
      `Memory ${mem.rssMB}MB ≥ ${memHardLimit}MB for ${stats.memory.breaches} consecutive checks`,
      { mem, platform: PLATFORM },
    );
  }

  if (stats.disk.breaches >= CFG.consecutiveBreach) {
    return triggerReset(
      `Disk ${disk.usedPct}% ≥ ${CFG.maxDiskPercent}% ` +
      `(or free ${disk.freeMB}MB ≤ ${CFG.minFreeDiskMB}MB) ` +
      `for ${stats.disk.breaches} consecutive checks`,
      { disk, platform: PLATFORM },
    );
  }
}

// ------------------------------------------------------------------
//  Main tick
// ------------------------------------------------------------------
async function runTick() {
  if (shuttingDown) return;
  tickCount++;

  // ---- Self-ping on every tick ----
  try {
    const t0 = Date.now();
    await selfPing(CFG.healthUrl);
    const latency = Date.now() - t0;

    stats.pings.total++;
    stats.pings.successful++;
    stats.pings.consecutiveFailures = 0;
    stats.pings.lastLatencyMs = latency;
    stats.pings.latencySum += latency;
    stats.pings.latencyMin = Math.min(stats.pings.latencyMin, latency);
    stats.pings.latencyMax = Math.max(stats.pings.latencyMax, latency);
  } catch {
    stats.pings.total++;
    stats.pings.failed++;
    stats.pings.consecutiveFailures++;
  }

  // ---- Resource check on every Nth tick ----
  if (tickCount % CFG.resourceEveryNTick === 0) {
    await runResourceCheck();
  }

  // ---- Overall status ----
  if (stats.pings.consecutiveFailures >= 5) {
    stats.status = 'down';
  } else if (stats.pings.consecutiveFailures > 0) {
    stats.status = 'degraded';
  } else if (stats.memory.breaches > 0 || stats.disk.breaches > 0) {
    stats.status = 'under-pressure';
  } else {
    stats.status = 'healthy';
  }
}

// ------------------------------------------------------------------
//  Public API
// ------------------------------------------------------------------
function start(server, port) {
  if (!CFG.enabled) {
    console.log('🩺 Unified monitor disabled (MONITOR_DISABLED=true)');
    return;
  }

  httpServer = server || null;

  const resolvedPort = port || process.env.PORT || 8080;
  CFG.healthUrl =
    process.env.MONITOR_HEALTH_URL || `http://localhost:${resolvedPort}/api/health`;

  console.log('🩺 Unified monitor started');
  console.log(`   Platform:        ${PLATFORM}`);
  console.log(`   Tick interval:   ${CFG.tickIntervalMs}ms`);
  console.log(`   Resource every:  ${CFG.resourceEveryNTick} ticks ` +
    `(${Math.round((CFG.tickIntervalMs * CFG.resourceEveryNTick) / 1000)}s)`);
  console.log(`   Memory limit:    ${CFG.maxMemoryMB}MB`);
  console.log(`   Disk limit:      ${CFG.maxDiskPercent}% (or < ${CFG.minFreeDiskMB}MB free)`);
  console.log(`   Breach threshold: ${CFG.consecutiveBreach} consecutive checks`);
  console.log(`   Self-ping:       ${CFG.healthUrl}`);
  console.log(`   Disk watch:      ${CFG.checkDiskPath}`);

  // First tick runs immediately
  runTick().catch((err) => console.error('[Monitor] Tick error:', err.message));

  intervalHandle = setInterval(() => {
    runTick().catch((err) => console.error('[Monitor] Tick error:', err.message));
  }, CFG.tickIntervalMs);
  intervalHandle.unref?.();
}

function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

function status() {
  return {
    platform: PLATFORM,
    enabled: CFG.enabled,
    config: {
      tickIntervalMs: CFG.tickIntervalMs,
      resourceEveryNTick: CFG.resourceEveryNTick,
      maxMemoryMB: CFG.maxMemoryMB,
      maxDiskPercent: CFG.maxDiskPercent,
      minFreeDiskMB: CFG.minFreeDiskMB,
      softThreshold: CFG.softThreshold,
      consecutiveBreach: CFG.consecutiveBreach,
      checkDiskPath: CFG.checkDiskPath,
      healthUrl: CFG.healthUrl,
    },
    stats: {
      startedAt: stats.startedAt,
      runningFor: Date.now() - stats.startedAt,
      status: stats.status,
      tickCount,
      resourceCheckCount,
      shuttingDown,
      pings: {
        total: stats.pings.total,
        successful: stats.pings.successful,
        failed: stats.pings.failed,
        consecutiveFailures: stats.pings.consecutiveFailures,
        lastLatencyMs: stats.pings.lastLatencyMs,
        avgLatencyMs: stats.pings.total > 0
          ? Math.round(stats.pings.latencySum / stats.pings.total)
          : 0,
        minLatencyMs: stats.pings.latencyMin === Infinity ? null : stats.pings.latencyMin,
        maxLatencyMs: stats.pings.latencyMax,
      },
      memory: {
        breaches: stats.memory.breaches,
        lastCheck: stats.memory.lastCheck,
      },
      disk: {
        breaches: stats.disk.breaches,
        lastCheck: stats.disk.lastCheck,
      },
      resets: stats.resets,
    },
  };
}

// ------------------------------------------------------------------
//  Process safety nets — install once
// ------------------------------------------------------------------
let safetyNetsInstalled = false;
function installSafetyNets() {
  if (safetyNetsInstalled) return;
  safetyNetsInstalled = true;

  process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught exception:', err);
    console.error('   Exiting so the platform restarts a fresh container.');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled rejection:', reason);
    console.error('   Exiting so the platform restarts a fresh container.');
    process.exit(1);
  });
}
installSafetyNets();

module.exports = {
  start,
  stop,
  status,
  triggerReset,
  getMemoryStats,
  getDiskStats,
};