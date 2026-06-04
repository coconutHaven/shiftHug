# shiftHug

NDIS invoicing for independent support workers — clients, shifts, calculations, and PDF invoices.

## Local development

Requirements: Node.js 18+ and npm.

```sh
npm install
npm run dev
```

This starts the API (`http://localhost:3001`) and the Vite frontend (`http://localhost:8080`). Open the app in your browser at port **8080**.

Other scripts:

- `npm run build` — production frontend build
- `npm run start` — run API with built frontend (production)
- `npm run test` — unit tests (Vitest)
- `npx playwright test` — browser tests (optional)

## Data

SQLite database file: `data/supportmate.db` (created automatically on first run).
