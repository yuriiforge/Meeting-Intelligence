# Meeting Intelligence

Ask questions about meeting transcripts — discussions, decisions and action items.

> Work in progress. Sections below will grow as the project does.

## Structure

```
apps/
  api/   NestJS backend (REST, /api prefix)
  web/   React + Vite frontend
```

npm workspaces; shared formatting config lives at the root.

## Quick start

Requires Node.js 24+.

```bash
npm install
npm run dev        # api on :3000, web on :5173 (proxies /api to the api)
```

Open http://localhost:5173 — the page shows the API health status.

## Scripts

| Command                     | What it does                    |
| --------------------------- | ------------------------------- |
| `npm run dev`               | Run api and web in watch mode   |
| `npm run build`             | Build both apps                 |
| `npm run lint`              | Lint both apps (oxlint)         |
| `npm test`                  | Unit tests (Vitest)             |
| `npm run test:e2e -w @mi/api` | API end-to-end tests          |
| `npm run format`            | Format everything with Prettier |
