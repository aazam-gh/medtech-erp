# Architecture

MedTech ERP is a TypeScript application with a Vite React frontend, a NestJS API, and PostgreSQL data access through Kysely.

## Frontend

The browser app starts at `src/main.tsx`. It defines a TanStack Router root route, the dashboard route, and a dynamic module route at `/$moduleKey`.

Primary frontend areas:

| Area | Location | Notes |
|---|---|---|
| App shell | `components/app-shell.tsx` | Sidebar, header, command palette, notifications, and theme toggle. |
| Dashboard | `components/dashboard.tsx` | Executive dashboard surface. |
| Generic module workspace | `components/module-workspace.tsx` | Renders scaffolded ERP modules from static data. |
| HR leave workspace | `components/hr-leave-workspace.tsx` | API-backed leave workflow UI. |
| Module data | `lib/erp-data.ts` | Navigation, module tabs, KPIs, and placeholder rows. |
| API client | `lib/api-client.ts` | Adds `x-dev-user`, serializes JSON bodies, downloads files. |
| Validation | `lib/validation.ts` | Zod schemas shared by frontend workflows. |

The app currently displays a broad ERP module shell. Most non-HR modules are scaffolded UI surfaces backed by local static data. The HR leave workspace is the main connected workflow that reads and writes through the API.

## API

The NestJS API starts at `apps/api/src/main.ts`. `AppModule` wires configuration, database access, health checks, and HR modules.

Primary API areas:

| Area | Location | Notes |
|---|---|---|
| App module | `apps/api/src/app.module.ts` | Root module and global config loading. |
| Database provider | `apps/api/src/database/kysely.provider.ts` | Creates the Kysely PostgreSQL connection. |
| Auth guards | `apps/api/src/auth/` | Local dev auth and permission enforcement. |
| Profiles | `apps/api/src/profiles/` | Loads authenticated users, roles, and permissions. |
| Permissions | `apps/api/src/permissions/` | Checks module/action access. |
| Health | `apps/api/src/health/` | Health and database health endpoints. |
| HR leave | `apps/api/src/hr/` | Leave controller, service, DTOs, and PDF generation. |
| Documents | `apps/api/src/documents/` | Local file-backed document storage service. |

## Auth and Permissions

Only local auth mode is implemented right now:

- `AUTH_MODE=local`.
- The frontend sends `x-dev-user` from `VITE_DEV_USER`.
- `DevAuthGuard` loads a matching active profile where `identity_provider = 'local'`.
- `PermissionGuard` checks the `@RequirePermission(module, action)` metadata.
- `super_admin` bypasses module/action permission checks.

The seeded local admin profile uses identity subject `admin` and receives `super_admin`.

## Data Access

PostgreSQL is the source of truth. The API uses Kysely with generated types from `database/generated/db.ts`.

Schema assets:

- `database/migrations/0001_core.sql`: core roles, profiles, departments, employees, products, documents, comments, activities, notifications, audit infrastructure, and shared functions.
- `database/migrations/0002_business.sql`: finance, sales, procurement, inventory, shipping, service, projects, attendance, leave request, and approval workflow tables.
- `database/migrations/0003_hr_leave.sql`: API-backed HR leave tables, triggers, validation, approval sync, handover, clearance, and rejoin records.
- `database/seeds/0001_roles_permissions.sql`: baseline roles, permissions, role permission grants, and document sequences.
- `database/seeds/0002_master_data.sql`: company, departments, profiles, role assignment, and sample master data.

## Runtime Modes

Full Docker stack:

- Builds the web app and serves it with Nginx on `http://localhost:8080`.
- Runs the API on `http://localhost:3001`.
- Runs PostgreSQL on host port `54322`.

Split local development:

- `npm run api:dev` runs NestJS through `tsx watch` and loads `.env.local`.
- `npm run web:dev` runs Vite on `http://localhost:5173`.
- `npm run db:up` starts only PostgreSQL using `docker-compose.local.yml`.

## Implementation Boundary

When extending the app, distinguish between these layers:

- UI scaffold: static module cards, tables, and action toasts in `lib/erp-data.ts` and `components/module-workspace.tsx`.
- Connected workflow: frontend state, API endpoints, service methods, SQL tables/triggers, permissions, documents, and validation.
- Shared contract: database schema, generated Kysely types, DTOs, Zod schemas, and frontend API client usage.
