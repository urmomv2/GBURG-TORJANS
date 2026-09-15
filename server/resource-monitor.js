// server/resource-monitor.js
// ============================================================
//  Trojans Proxy Hub — Resource Monitor
// ============================================================
//  Watches memory usage and disk usage. When either crosses a
//  threshold, it:
//    1. Logs the reason clearly
//    2. Stops accepting new HTTP requests
//    3. Closes the server gracefully (with timeout)
//    4. Exits the process → platform auto-restarts a fresh
//       container on Render, Railway, Fly, Docker, etc.
//
//  Auto-detects free-tier limits for Render and Railway, but
//  every threshold is overridable via env vars.
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');

// ------------------------------------------------------------------
//  Platform detection
// ------------------------------------------------------------------
function detectPlatform() {
  if (process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID) {
    return 'render';
  }
  if (
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID
  ) {
    return 'railway';
  }
  if (process.env.FLY_APP_NAME) return 'fly';
  if (process.env.DYNO) return 'heroku';
  return 'local';
}

const PLATFORM = detectPlatform();

// Default per-platform thresholds — disk cap at 85% across the board
const PLATFORM_DEFAULTS = {
  render:  { maxMemoryMB: 480,  maxDiskPercent: 85 },
  railway: { maxMemoryMB: 480,  maxDiskPercent: 85 },
  fly:     { maxMemoryMB: 400,  maxDiskPercent: 85 },
  heroku:  { maxMemoryMB: 480,  maxDiskPercent: 85 },
  local:   { maxMemoryMB: 1024, maxDiskPercent: 85 },
};

const DEFAULTS = PLATFORM_DEFAULTS[PLATFORM] || PLATFORM_DEFAULTS.local;

// ------------------------------------------------------------------
//  Config (all overridable via env vars)
// ------------------------------------------------------------------
const CFG = {
  enabled:            process.env.RESOURCE_MONITOR_DISABLED !== 'true',
  checkIntervalMs:    parseInt(process.env.RESOURCE_CHECK_INTERVAL_MS || '30000', 10),
  maxMemoryMB:        parseInt(process.env.RESOURCE_MAX_MEMORY_MB || String(DEFAULTS.maxMemoryMB), 10),
  maxDiskPercent:     parseInt(process.env.RESOURCE_MAX_DISK_PERCENT || String(DEFAULTS.maxDiskPercent), 10),
  minFreeDiskMB:      parseInt(process.env.RESOURCE_MIN_FREE_DISK_MB || '100', 10),
  softThreshold:      parseFloat(process.env.RESOURCE_SOFT_THRESHOLD || '0.85'), // 85% of limit
  consecutiveBreach:  parseInt(process.env.RESOURCE_CONSECUTIVE_BREACH || '2', 10),
  gracefulTimeoutMs:  parseInt(process.env.RESOURCE_GRACEFUL_TIMEOUT_MS || '5000', 10),
  checkDiskPath:      process.env.RESOURCE_DISK_PATH || path.join(__dirname, 'data'),
  logEveryN:          parseInt(process.env.RESOURCE_LOG_EVERY_N || '10', 10),
};

// ------------------------------------------------------------------
//  State
// ------------------------------------------------------------------
let httpServer = null;
let intervalHandle = null;
let checksPerformed = 0;
let memoryBreaches = 0;
let diskBreaches = 0;
let shuttingDown = false;

// ------------------------------------------------------------------
//  Memory check
// ------------------------------------------------------------------
function getMemoryStats() {
  const m = process.memoryUsage();
  const rssMB = Math.round(m.rss / 1024 / 1024);
  const heapUsedMB = Math.round(m.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(m.heapTotal / 1024 / 1024);
  const externalMB = Math.round(m.external / 1024 / 1024);
  return { rssMB, heapUsedMB, heapTotalMB, externalMB };
}

// ------------------------------------------------------------------
//  Disk check — Node 18.15+ has fs.statfs, fall back to `df -k`
// ------------------------------------------------------------------
async function getDiskStats(targetPath) {
  if (typeof fs.promises.statfs === 'function') {
    try {
      const s = await fs.promises.statfs(targetPath);
      const totalBytes = Number(s.bsize) * Number(s.blocks);
      const freeBytes  = Number(s.bsize) * Number(s.bfree);
      const usedBytes  = totalBytes - freeBytes;
      const usedPct    = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
      const freeMB     = Math.round(freeBytes / 1024 / 1024);
      const totalMB    = Math.round(totalBytes / 1024 / 1024);
      return { totalMB, freeMB, usedPct: Number(usedPct.toFixed(1)) };
    } catch {
      // fall through to df
    }
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
//  Graceful shutdown
// ------------------------------------------------------------------
async function triggerReset(reason, stats) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.error('');
  console.error('════════════════════════════════════════════════════════════');
  console.error('  ⚠️  RESOURCE THRESHOLD EXCEEDED — INITIATING FULL RESET');
  console.error('════════════════════════════════════════════════════════════');
  console.error(`  Reason:    ${reason}`);
  console.error(`  Platform:  ${PLATFORM}`);
  console.error(`  Stats:     ${JSON.stringify(stats, null, 2)}`);
  console.error(`  Uptime:    ${Math.round(process.uptime())}s`);
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
//  Main check loop
// ------------------------------------------------------------------
async function runCheck() {
  if (shuttingDown) return;
  checksPerformed++;

  // ---- Memory ----
  const mem = getMemoryStats();
  const memOverLimit = mem.rssMB >= CFG.maxMemoryMB;
  const memSoftLimit = Math.floor(CFG.maxMemoryMB * CFG.softThreshold);
  const memNearLimit = mem.rssMB >= memSoftLimit;

  if (memOverLimit) {
    memoryBreaches++;
  } else if (memNearLimit) {
    if (checksPerformed % CFG.logEveryN === 0) {
      console.warn(
        `⚠️  [Resource] Memory near limit: ${mem.rssMB}MB / ${CFG.maxMemoryMB}MB ` +
        `(${Math.round((mem.rssMB / CFG.maxMemoryMB) * 100)}%)`,
      );
    }
  } else {
    memoryBreaches = 0;
  }

  // ---- Disk ----
  const disk = await getDiskStats(CFG.checkDiskPath);
  let diskOverLimit = false;
  let diskNearLimit = false;

  if (disk) {
    diskOverLimit = disk.usedPct >= CFG.maxDiskPercent || disk.freeMB <= CFG.minFreeDiskMB;
    diskNearLimit = disk.usedPct >= CFG.maxDiskPercent * CFG.softThreshold;

    if (diskOverLimit) {
      diskBreaches++;
    } else if (diskNearLimit) {
      if (checksPerformed % CFG.logEveryN === 0) {
        console.warn(
          `⚠️  [Resource] Disk near limit: ${disk.usedPct}% used ` +
          `(${disk.freeMB}MB free / ${disk.totalMB}MB total)`,
        );
      }
    } else {
      diskBreaches = 0;
    }
  }

  // ---- Periodic status log ----
  if (checksPerformed % CFG.logEveryN === 0 && !memOverLimit && !diskOverLimit) {
    console.log(
      `📊 [Resource] Mem ${mem.rssMB}MB/${CFG.maxMemoryMB}MB · ` +
      (disk ? `Disk ${disk.usedPct}%/${CFG.maxDiskPercent}%` : 'Disk n/a') +
      ` · uptime ${Math.round(process.uptime())}s`,
    );
  }

  // ---- Trigger reset if thresholds hit N times in a row ----
  if (memoryBreaches >= CFG.consecutiveBreach) {
    return triggerReset(
      `Memory exceeded ${CFG.maxMemoryMB}MB for ${memoryBreaches} consecutive checks`,
      { mem, platform: PLATFORM },
    );
  }

  if (diskBreaches >= CFG.consecutiveBreach) {
    return triggerReset(
      `Disk exceeded ${CFG.maxDiskPercent}% (or free < ${CFG.minFreeDiskMB}MB) ` +
      `for ${diskBreaches} consecutive checks`,
      { disk, platform: PLATFORM },
    );
  }
}

// ------------------------------------------------------------------
//  Public API
// ------------------------------------------------------------------
function start(server) {
  if (!CFG.enabled) {
    console.log('🩺 Resource monitor disabled (RESOURCE_MONITOR_DISABLED=true)');
    return;
  }

  httpServer = server || null;

  console.log('🩺 Resource monitor started');
  console.log(`   Platform:        ${PLATFORM}`);
  console.log(`   Memory limit:    ${CFG.maxMemoryMB}MB`);
  console.log(`   Disk limit:      ${CFG.maxDiskPercent}% (or < ${CFG.minFreeDiskMB}MB free)`);
  console.log(`   Check interval:  ${CFG.checkIntervalMs}ms`);
  console.log(`   Breach threshold: ${CFG.consecutiveBreach} consecutive checks`);
  console.log(`   Watch path:      ${CFG.checkDiskPath}`);

  runCheck().catch((err) => console.error('[Resource] Check error:', err.message));

  intervalHandle = setInterval(() => {
    runCheck().catch((err) => console.error('[Resource] Check error:', err.message));
  }, CFG.checkIntervalMs);
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
    config: { ...CFG },
    state: {
      checksPerformed,
      memoryBreaches,
      diskBreaches,
      shuttingDown,
    },
  };
}

// ------------------------------------------------------------------
//  Safety nets
// ------------------------------------------------------------------
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

module.exports = { start, stop, status, triggerReset, getMemoryStats, getDiskStats };