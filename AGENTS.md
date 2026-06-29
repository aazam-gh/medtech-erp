## TypeScript project

This project is a TypeScript/Node ERP application with a Vite React frontend, a NestJS API, and PostgreSQL-backed data access.

## Navigation

- Use `rg` and direct repo inspection for codebase navigation.
- Start with the file or module named by the user, then widen scope only when the implementation path requires it.
- Read the existing docs before changing architecture, workflow, database, deployment, or permissions behavior:
  - `docs/GETTING_STARTED.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DATABASE.md`
  - `docs/HR_LEAVE_WORKFLOW.md`
  - `docs/DEVELOPMENT_GUIDE.md`
  - `docs/PRODUCTION.md`
  - `docs/ROLE_MATRIX.md`

## Tooling and scripts

- Keep implementation and project tooling within the existing TypeScript/JavaScript, npm, and SQL assets.
- Prefer existing npm scripts for validation:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm run db:up`, `npm run db:wait`, `npm run db:migrate`, `npm run db:seed`, `npm run db:reset`
- `npm run dev` and `npm run web:dev` start only the Vite frontend.
- `npm run api:dev` starts the NestJS API with `.env.local`.
- `docker compose up --build` starts the full Docker stack.

## Architecture boundaries

- The React app entrypoint and TanStack Router setup live in `src/main.tsx`.
- Shared shell/workspace UI lives in `components/`.
- Static ERP navigation and placeholder module data live in `lib/erp-data.ts`.
- Connected API-backed workflows currently center on the HR leave workspace.
- The NestJS API lives under `apps/api/src/`.
- Database schema changes belong in versioned SQL files under `database/migrations/`.
- Seed data belongs in `database/seeds/`.
- Kysely types in `database/generated/db.ts` are generated from the database schema; do not hand-edit them as the source of truth.

## Safe change workflow

- Inspect before editing, especially around database migrations, generated types, permissions, and HR leave triggers.
- Keep changes scoped to the requested module unless a shared contract must change.
- When changing SQL schema, update or add migrations, run the migration locally, then regenerate Kysely types with `npm run db:types`.
- When changing API request/response shapes, update shared validation/types and the frontend client usage together.
- Preserve local auth behavior unless the task explicitly asks to replace it: `AUTH_MODE=local`, `x-dev-user`, and seeded local profiles.
- Do not introduce unrelated package managers, build tools, ORMs, migration frameworks, or runtime services.

## Validation expectations

- For TypeScript or behavior changes, run `npm run typecheck` and the narrowest relevant runtime/manual check.
- For broader frontend/API changes, run `npm run lint` and `npm run build` when feasible.
- For Docker/deployment changes, run `docker compose config`.
- If a validation command cannot run because of missing local services or environment, report the exact blocker and the command that failed.
