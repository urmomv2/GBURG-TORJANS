# ============================================================
#  Trojans Proxy Hub — Dockerfile
# ============================================================
#  Multi-stage build:
#    1. Builder   — installs deps, generates endpoints, vendors
#                   Firefox WASM, builds the React frontend
#    2. Production — minimal Node runtime with the built dist,
#                    server code, and the vendored VM assets
#
#  IMPORTANT: The production stage pulls the /scripts folder
#  FROM THE BUILDER STAGE (not from the build context) so the
#  download-games.sh lookup never fails on Render / Railway.
# ============================================================

# ------------------------------------------------------------
#  Stage 1 — Builder
# ------------------------------------------------------------
FROM node:20-alpine AS builder

# tar       → needed by the Firefox WASM vendoring script
# bash      → needed by helper scripts
# curl      → used by vendoring + game download
# unzip     → used by game download
# gzip      → needed for .tar.gz extraction
RUN apk add --no-cache bash curl tar unzip gzip

WORKDIR /app

# ---- Install root deps first (better layer caching) ----
COPY package.json ./
RUN npm install

# ---- Copy the entire project into the builder ----
# This puts everything (including /scripts) into /app
COPY . .

# ---- Verify the scripts folder actually landed ----
RUN ls -la /app/scripts/ || (echo "❌ scripts/ folder missing" && exit 1)
RUN test -f /app/scripts/download-games.sh || (echo "❌ download-games.sh missing" && exit 1)

# ---- Step 1: Generate random endpoint aliases ----
RUN node scripts/generate-endpoints.js

# ---- Step 2: Download + patch Firefox WASM ----
# Uses `|| true` so a GitHub hiccup doesn't fail the entire image.
# The VM tab will show "assets not installed" and can be retried later.
RUN node scripts/vendor-firefox-wasm.js || \
    echo "⚠️  Firefox WASM vendoring skipped — VM tab will show 'not installed'"

# ---- Step 3: Typecheck + build the React frontend ----
RUN npm run build

# ------------------------------------------------------------
#  Stage 2 — Production
# ------------------------------------------------------------
FROM node:20-alpine AS production

# Runtime deps for the entrypoint + game downloader
RUN apk add --no-cache bash curl unzip tar gzip

WORKDIR /app

# ---------- Install server deps only ----------
COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

# ---------- Copy server source ----------
COPY server/ ./server/

# ---------- Copy built frontend from builder ----------
COPY --from=builder /app/dist ./dist

# ---------- Copy public assets (includes vendored firefox-wasm) ----------
COPY --from=builder /app/public ./public

# ---------- Copy the endpoint map generated during build ----------
COPY --from=builder /app/server/data/endpoints.json ./server/data/endpoints.json

# ---------- Copy the /scripts folder FROM THE BUILDER STAGE ----------
# ← This is the fix. Instead of pulling from the build context
#   (which was failing with "not found" on Render/Railway), we
#   pull from the builder stage where COPY . . already succeeded.
COPY --from=builder /app/scripts ./scripts

# ---------- Verify the file is there before running it ----------
RUN test -f ./scripts/download-games.sh || (echo "❌ download-games.sh still missing after COPY --from=builder" && exit 1)

# ---------- Run the game downloader ----------
RUN chmod +x ./scripts/download-games.sh && ./scripts/download-games.sh

# ---------- Ensure runtime dirs exist ----------
RUN mkdir -p /app/server/data /app/server/data/storage

# ---------- Environment ----------
ENV NODE_ENV=production
ENV PORT=8080

# ---------- Optional: tune the monitor via env ----------
# These are the defaults baked into server/monitor.js — uncomment
# to override at build time. You can also set them at runtime via
# the Render/Railway dashboard or docker-compose environment block.
# ENV MONITOR_MAX_MEMORY_MB=480
# ENV MONITOR_MAX_DISK_PERCENT=85
# ENV MONITOR_CONSECUTIVE_BREACH=2
# ENV MONITOR_TICK_INTERVAL_MS=1000
# ENV MONITOR_RESOURCE_EVERY_N=30

EXPOSE 8080

# ---------- Healthcheck uses the built-in /api/health endpoint ----------
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["node", "server/server.js"]