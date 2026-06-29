# Development Guide

Use this guide when extending MedTech ERP beyond the existing scaffold.

## Change Workflow

1. Inspect the current module, schema, and docs before editing.
2. Identify whether the change is only UI scaffold, API-backed workflow, database contract, or deployment behavior.
3. Keep the change in the existing TypeScript, npm, NestJS, React, Kysely, and SQL stack.
4. Update docs when behavior, setup, schema, workflow, or validation expectations change.
5. Run the narrowest meaningful validation before handoff.

## Adding an API-Backed Module

Follow the current HR leave pattern:

1. Add or extend SQL migrations under `database/migrations/`.
2. Apply migrations locally with `npm run db:migrate`.
3. Add or update seed data under `database/seeds/` if roles, permissions, sequences, or baseline records are required.
4. Regenerate Kysely types with `npm run db:types`.
5. Add NestJS module/controller/service code under `apps/api/src/`.
6. Enforce permissions with `@RequirePermission(module, action)` on controller classes or handlers.
7. Add shared validation and frontend-facing types under `lib/`.
8. Add frontend API calls through `lib/api-client.ts`.
9. Add or replace UI in `components/`, keeping static scaffold data separate from connected data.
10. Validate with typecheck, lint, build, and any manual workflow checks needed for the change.

## Frontend Guidelines

- `src/main.tsx` owns top-level routing.
- `components/app-shell.tsx` owns the global layout.
- `components/module-workspace.tsx` renders static module workspaces and hands off to connected module components when implemented.
- `lib/erp-data.ts` is scaffold/navigation data, not a durable business data source.
- Use `lib/api-client.ts` for API requests so local auth headers and error parsing remain consistent.
- Keep user-facing data validation in Zod schemas where practical.

## API Guidelines

- Put feature code in its own NestJS module when it has controller/service behavior.
- Keep database access in services using the injected `KyselyProvider`.
- Use transactions for multi-step writes.
- Let PostgreSQL constraints and triggers enforce durable workflow invariants.
- Surface clear `BadRequestException`, `NotFoundException`, `UnauthorizedException`, or `ForbiddenException` errors for expected failure modes.
- Do not bypass `DevAuthGuard` and `PermissionGuard` for business endpoints unless the endpoint is intentionally public, such as health checks.

## Database Guidelines

- SQL migrations are the schema source of truth.
- Avoid editing existing migrations after they have been shared or applied outside a disposable local database. Add a new migration instead.
- Keep generated Kysely types synchronized with the applied schema.
- Use document sequences for human-facing business numbers.
- Prefer database constraints/triggers for critical workflow invariants that must survive any API caller.
- Use soft deletion where existing tables use `deleted_at`.

## Validation Checklist

Use the smallest set that covers the change:

```bash
npm run typecheck
npm run lint
npm run build
```

When database schema changes:

```bash
npm run db:migrate
npm run db:types
npm run typecheck
```

When Docker or deployment files change:

```bash
docker compose config
```

For HR leave workflow changes, also manually check the affected path in the UI with the API running:

- Load the Leave tab.
- Create or edit an application.
- Submit, cancel, approve, or reject as relevant.
- Verify downstream handover, clearance, or rejoin behavior when the change touches approved leave.
- Verify uploads/downloads or generated PDFs when document behavior changes.

## Common Pitfalls

- `npm run dev` starts only the Vite frontend. Run `npm run api:dev` separately for API-backed features.
- The frontend must point to the API through `VITE_API_BASE_URL`.
- Local API auth requires `x-dev-user`; use `lib/api-client.ts` instead of raw `fetch` in frontend code.
- The seeded local user is `admin`; reseed the database if local auth cannot find it.
- `database/generated/db.ts` can become stale after SQL changes.
- The full Docker stack and local-only database stack both use host port `54322`.
- Trigger-driven HR leave records can look missing if an application has not reached the status that creates them.
