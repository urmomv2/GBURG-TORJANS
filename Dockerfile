# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN node scripts/generate-endpoints.js
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS production

WORKDIR /app

COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/
COPY --from=builder /app/public ./public
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/server.js"]
