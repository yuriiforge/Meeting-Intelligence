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

### Run everything in Docker

Requires Docker.

```bash
docker compose up --build
```

Open http://localhost:8080. This starts:

| Service | What it is                                   | Host port |
| ------- | -------------------------------------------- | --------- |
| `web`   | nginx serving the built SPA, proxying `/api` | 8080      |
| `api`   | NestJS backend                               | —         |
| `db`    | Postgres 17 with pgvector                    | 5432      |

Ports and credentials have defaults; copy `.env.example` to `.env` to change them.

### Local development (hot reload)

Requires Node.js 24+ and Docker (for the database).

```bash
npm install
npm run db:up      # Postgres only, in Docker
npm run dev        # api on :3000, web on :5173 (proxies /api to the api)
```

Open http://localhost:5173. The page shows the API health status.

## Scripts

| Command                       | What it does                    |
| ----------------------------- | ------------------------------- |
| `npm run dev`                 | Run api and web in watch mode   |
| `npm run build`               | Build both apps                 |
| `npm run lint`                | Lint both apps (oxlint)         |
| `npm test`                    | Unit tests (Vitest)             |
| `npm run test:e2e -w @mi/api` | API end-to-end tests            |
| `npm run format`              | Format everything with Prettier |
| `npm run docker:up`           | Build and run the full stack    |
| `npm run docker:down`         | Stop the full stack             |
| `npm run db:up`               | Start only Postgres             |
