# Trojans Proxy Hub

A full-stack proxy hub with games, multiple proxy engines, and randomized endpoints.

## Quick Start

```bash
npm install
cd server && npm install && cd ..
npm start
```

Visit `http://localhost:5173`.

## Production

```bash
docker-compose up --build
```

Visit `http://localhost:8080`.

## Required External Files (not included)

Place these from [PeteZahGames/public](https://github.com/PeteZahGames):

- `server/modules/uv/*` — Scramjet v2 bundles
- `public/*` — proxy client files (except `iframe.html` which is included)

Then paste your `games.json` into `server/data/games.json`.

## Endpoints

Randomized on every build via `scripts/generate-endpoints.js`.
