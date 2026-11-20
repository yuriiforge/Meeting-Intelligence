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

Open http://localhost:8080. This starts, in order:

| Service   | What it is                                       | Host port |
| --------- | ------------------------------------------------ | --------- |
| `db`      | Postgres 17 with pgvector                        | 5432      |
| `migrate` | One-off job: applies migrations, then exits      | —         |
| `api`     | NestJS backend (starts after `migrate` succeeds) | —         |
| `web`     | nginx serving the built SPA, proxying `/api`     | 8080      |

Ports and credentials have defaults; copy `.env.example` to `.env` to change them.

### Local development (hot reload)

Requires Node.js 24+ and Docker (for the database).

```bash
npm install                                # also generates the Prisma client
cp apps/api/.env.example apps/api/.env     # DATABASE_URL for local dev
npm run db:up                              # Postgres only, in Docker
npm run db:migrate                         # apply migrations
npm run dev                                # api on :3000, web on :5173
```

Open http://localhost:5173. The page shows the API and database health.

The api validates its environment at startup and exits with a readable error if
anything is missing or malformed (see `apps/api/src/config/env.ts`).

## Database

Schema: [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma)

- `meetings`: one row per uploaded transcript, with a processing status.
- `utterances`: one row per speaker turn (`[00:12:34] Alice: ...`), which is
  the source of truth for displaying transcripts and resolving citations.
- `chunks`: retrieval units made of whole utterances, with a pgvector
  `embedding` column (768 dims, matching `nomic-embed-text`).

To change the schema, edit `schema.prisma`, then run `npm run db:migrate`.
That command creates and applies a new migration.

## Transcripts

Plain-text files (`.txt` or `.md`, UTF-8, up to 1 MB) with one speaker turn per line:

```
Title: Weekly sync          <- optional header (or "# Weekly sync")
Date: 2026-11-03            <- optional header

[00:00:04] Priya Shah: Okay, I think everyone's here.
[00:00:19] Marcus Chen: Sounds good.
  Lines without a timestamp continue the previous turn.
```

Timestamps can be `[hh:mm:ss]`, `[mm:ss]` or the same without brackets.
Unparseable lines are skipped and reported as warnings in the upload response.
A file with no speaker turns is rejected with `422`.

[`samples/transcripts/`](samples/transcripts/) has four connected meetings of a
fictional product team, useful for trying questions across meetings.

### API

| Method | Path                | What it does                                              |
| ------ | ------------------- | --------------------------------------------------------- |
| `POST` | `/api/meetings`     | Upload a transcript (multipart: `file`, optional `title`) |
| `GET`  | `/api/meetings`     | List meetings, most recent first                          |
| `GET`  | `/api/meetings/:id` | One meeting with its full transcript                      |
| `GET`  | `/api/health`       | API and database health                                   |

```bash
curl -F "file=@samples/transcripts/2026-11-03-mobile-2-0-kickoff.txt" \
  http://localhost:8080/api/meetings
```

## Tests

| Suite       | Command                       | Needs             | Covers                               |
| ----------- | ----------------------------- | ----------------- | ------------------------------------ |
| Unit        | `npm test`                    | nothing           | Parser, chunker, config, controllers |
| E2E         | `npm run test:e2e -w @mi/api` | nothing (fake DB) | HTTP stack, health                   |
| Integration | `npm run test:int`            | `npm run db:up`   | Meetings API against real Postgres   |

Integration tests use a separate `meeting_intelligence_test` database. It is
created and migrated automatically and emptied before each test.

## Scripts

| Command                       | What it does                        |
| ----------------------------- | ----------------------------------- |
| `npm run dev`                 | Run api and web in watch mode       |
| `npm run build`               | Build both apps                     |
| `npm run lint`                | Lint both apps (oxlint)             |
| `npm test`                    | Unit tests (Vitest)                 |
| `npm run test:e2e -w @mi/api` | API end-to-end tests                |
| `npm run test:int`            | Integration tests (needs Postgres)  |
| `npm run format`              | Format everything with Prettier     |
| `npm run docker:up`           | Build and run the full stack        |
| `npm run docker:down`         | Stop the full stack                 |
| `npm run db:up`               | Start only Postgres                 |
| `npm run db:migrate`          | Create/apply migrations (dev)       |
| `npm run db:studio`           | Browse the database (Prisma Studio) |
