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
# ============================================================

# ============================================================
#  STAGE 1 — Builder
# ============================================================
FROM node:20-alpine AS builder

# tar → needed by vendor-firefox-wasm
# bash → needed by download-games.sh
# curl → needed by download-games.sh
# unzip → needed by download-games.sh
RUN apk add --no-cache bash curl tar unzip

WORKDIR /app

# ---- Frontend deps ----
COPY package.json ./
RUN npm install

# ---- Copy everything else ----
COPY . .

# ---- Generate randomized endpoints ----
RUN node scripts/generate-endpoints.js

# ---- Vendor Firefox WASM ----
RUN node scripts/vendor-firefox-wasm.js

# ---- Build the React frontend ----
RUN npm run build

# ============================================================
#  STAGE 2 — Production
# ============================================================
FROM node:20-alpine AS production

# Runtime tools for the entrypoint + game downloader
RUN apk add --no-cache bash curl unzip tar

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

# ---- Copy + run the game downloader ----
COPY scripts/download-games.sh ./scripts/download-games.sh
RUN chmod +x ./scripts/download-games.sh && ./scripts/download-games.sh

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
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O- http://localhost:8080/api/health || exit 1

CMD ["node", "server/server.js"]