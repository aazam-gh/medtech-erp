# Getting Started

This guide is for local maintainers and agents setting up MedTech ERP from a clean checkout.

## Prerequisites

- Node.js 22 or newer.
- npm 10 or newer.
- Docker with Docker Compose v2.
- PostgreSQL client tools available on the host when running database scripts directly. The scripts use `psql` and `pg_isready`.

## Environment

Create a local environment file from the checked-in example:

```bash
cp .env.example .env.local
```

Important variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string used by the API, migrations, seeds, and Kysely code generation. |
| `AUTH_MODE` | Currently only `local` is implemented. |
| `PORT` | API port. Defaults to `3001`. |
| `LOCAL_STORAGE_ROOT` | Local directory or mounted path for uploaded/generated documents. |
| `VITE_API_BASE_URL` | API base URL used by the frontend. |
| `VITE_DEV_USER` | Local profile identity sent through the `x-dev-user` header. The seeded admin user is `admin`. |

## Full Docker Stack

Use the full stack when you want PostgreSQL, the API, and the production-built web app together:

```bash
npm ci
docker compose up --build
```

Services:

| Service | URL or port |
|---|---|
| Web app | `http://localhost:8080` |
| API | `http://localhost:3001` |
| API health | `http://localhost:3001/health` |
| Database | Host port `54322` |

The full Compose stack initializes the `medtech` database from `database/migrations/` and `database/seeds/` when the PostgreSQL volume is first created.

## Split Local Development

Use split development when editing frontend or API code:

```bash
npm ci
cp .env.example .env.local
npm run db:up
npm run db:wait
npm run db:migrate
npm run db:seed
```

Then run the API and frontend in separate terminals:

```bash
npm run api:dev
```

```bash
npm run web:dev
```

Local development URLs:

| Service | URL |
|---|---|
| Vite dev server | `http://localhost:5173` |
| Vite preview server | `http://localhost:4173` |
| NestJS API | `http://localhost:3001` |
| API health | `http://localhost:3001/health` |

`npm run dev` is equivalent to the Vite web dev server. It does not start the API.

## Database Reset

To rebuild the local Docker database from scratch:

```bash
npm run db:reset
```

To stop the local database without deleting the volume:

```bash
npm run db:down
```

## Common Startup Problems

- If the API returns `x-dev-user is required in local auth mode`, the request is not using `lib/api-client.ts` or is missing the `x-dev-user` header.
- If the API returns `Local user was not found`, confirm `.env.local` has `VITE_DEV_USER=admin` and that seeds were applied.
- If migrations fail with connection errors, run `npm run db:up` and `npm run db:wait` before `npm run db:migrate`.
- If TypeScript references missing database columns after a schema change, apply the migration and run `npm run db:types`.
- If the frontend loads but HR leave data fails, confirm `npm run api:dev` is running and `VITE_API_BASE_URL` points to `http://localhost:3001`.
