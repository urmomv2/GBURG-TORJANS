# ============================================================
#  Trojans Proxy Hub — Multi-stage Docker Build
# ============================================================
#  Stage 1 (builder):
#    • Installs frontend + build tooling
#    • Generates randomized endpoints
#    • Downloads & patches Firefox WASM
#    • Compiles the React frontend to /dist
#
#  Stage 2 (production):
#    • Installs server deps only
#    • Copies server code + built frontend + vendored VM
#    • Downloads the game library
#    • Runs the Express server on port 8080
#
#  IMPORTANT:
#  The /scripts folder is copied FROM THE BUILDER STAGE, not
#  from the build context. This avoids the "download-games.sh
#  not found" error on Render / Railway where the build context
#  may not include every file from the repo.
# ============================================================

# ============================================================
#  STAGE 1 — Builder
# ============================================================
FROM node:20-alpine AS builder

# tar       → needed by vendor-firefox-wasm
# bash      → needed by download-games.sh
# curl      → needed by download-games.sh + vendoring
# unzip     → needed by download-games.sh
# gzip      → needed for .tar.gz extraction
RUN apk add --no-cache bash curl tar unzip gzip

WORKDIR /app

# ---- Frontend deps (cached layer) ----
COPY package.json ./
RUN npm install

# ---- Copy the entire project into the builder ----
COPY . .

# ---- Verify the scripts folder actually landed ----
# If this fails, the file isn't committed to git or is being
# excluded by .dockerignore.
RUN ls -la /app/scripts/ || (echo "❌ scripts/ folder missing from build context" && exit 1)
RUN test -f /app/scripts/download-games.sh || (echo "❌ scripts/download-games.sh missing — is it committed to git?" && exit 1)
RUN test -f /app/scripts/generate-endpoints.js || (echo "❌ scripts/generate-endpoints.js missing" && exit 1)
RUN test -f /app/scripts/vendor-firefox-wasm.js || (echo "❌ scripts/vendor-firefox-wasm.js missing" && exit 1)

# ---- Generate randomized endpoints ----
RUN node scripts/generate-endpoints.js

# ---- Vendor Firefox WASM ----
# Uses `|| true` so a GitHub hiccup doesn't fail the entire image.
# The VM tab will show "assets not installed" and can be retried
# by rebuilding without cache.
RUN node scripts/vendor-firefox-wasm.js || \
    echo "⚠️  Firefox WASM vendoring skipped — VM tab will show 'not installed'"

# ---- Build the React frontend ----
RUN npm run build

# ============================================================
#  STAGE 2 — Production
# ============================================================
FROM node:20-alpine AS production

# Runtime tools for the entrypoint + game downloader
RUN apk add --no-cache bash curl unzip tar gzip

WORKDIR /app

# ---- Install server deps only ----
COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

# ---- Copy server source ----
COPY server/ ./server/

# ---- Copy built frontend from builder ----
COPY --from=builder /app/dist ./dist

# ---- Copy public assets (includes vendored firefox-wasm) ----
COPY --from=builder /app/public ./public

# ---- Copy the endpoint map generated during build ----
COPY --from=builder /app/server/data/endpoints.json ./server/data/endpoints.json

# ---- Copy the /scripts folder FROM THE BUILDER STAGE ----
# ← THE FIX
# The old Dockerfile did:
#     COPY scripts/download-games.sh ./scripts/download-games.sh
# which looked in the build context and failed on Render/Railway.
# Now we pull from the builder stage where COPY . . already
# succeeded — so the file is guaranteed to be present.
COPY --from=builder /app/scripts ./scripts

# ---- Verify the download script is present before running it ----
RUN test -f ./scripts/download-games.sh || (echo "❌ download-games.sh still missing after COPY --from=builder" && exit 1)

# ---- Run the game downloader ----
RUN chmod +x ./scripts/download-games.sh && ./scripts/download-games.sh

# ---- Ensure runtime dirs exist ----
RUN mkdir -p /app/server/data /app/server/data/storage

# ---- Runtime env ----
ENV NODE_ENV=production
ENV PORT=8080

# ---- Monitor defaults (override via docker-compose or -e) ----
ENV MONITOR_TICK_INTERVAL_MS=1000
ENV MONITOR_RESOURCE_EVERY_N=30
ENV MONITOR_MAX_MEMORY_MB=480
ENV MONITOR_MAX_DISK_PERCENT=85
ENV MONITOR_MIN_FREE_DISK_MB=100
ENV MONITOR_CONSECUTIVE_BREACH=2

EXPOSE 8080

# ---- Healthcheck uses the built-in /api/health endpoint ----
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O- http://localhost:8080/api/health || exit 1

CMD ["node", "server/server.js"]