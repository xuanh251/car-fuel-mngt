# Car Fuel Management Web App

A web application for tracking car fuel consumption.

## Prerequisites
- Node.js 22 or 24 LTS
- SQLite3

## Installation
```bash
# Install dependencies for all workspaces (backend and frontend) from the repo root
npm install
```

## Development
```bash
# Start backend (http://localhost:3000) and frontend (Vite, http://localhost:5173) together
npm run dev

# Start only the backend
npm run dev --prefix backend
```

The Vite dev server proxies `/api` requests to the backend on port 3000.

Environment variables `PORT`, `DATABASE_PATH`, `NODE_ENV` and `VITE_API_TARGET` pass through to both dev servers. If you change `PORT`, also set `VITE_API_TARGET=http://localhost:<PORT>`, or the `/api` proxy still points at port 3000.

## Production Run
```bash
# Build all workspaces from the repo root
npm run build

# Start backend
cd backend && npm start
```

## Environment Variables
- `PORT`: Server port (default: 3000)
- `DATABASE_PATH`: Path to SQLite database (default: `./data/app.db`)
- `NODE_ENV`: `production` or `development`

## Testing
```bash
# Unit tests for backend and frontend, from the repo root
npm test

# E2E tests
cd frontend && npx playwright install chromium
cd frontend && npm run test:e2e
```
