# MedTech ERP

Production-oriented enterprise resource planning platform for MedTech Corporation Trading W.L.L., Doha, Qatar. It provides one modular workspace for finance, HR, sales, procurement, inventory, shipping, after-sales service, turnkey projects, documents, approvals, reporting, and administration.

## Included

- Premium responsive application shell, executive dashboard, global search/command palette, notifications, light/dark themes, operational list views, filters, KPIs, and role-aware navigation foundation.
- PostgreSQL schema covering commercial, finance, supply chain, service, projects, HR, documents, approvals, activities, notifications, and immutable audit events.
- NestJS API with Kysely, UUID keys, soft deletion, document sequences, local file-backed document storage, validation, and permission guards.
- Branded A4 PDF engine and 12 configured templates: estimation, quotation, invoice, receipt, purchase order, delivery note, packing list, service report, employee letter, experience certificate, leave approval, and payment voucher.
- Excel import/export foundations with per-row validation errors.
- Docker Compose stack for PostgreSQL, the NestJS API, and the TanStack Router frontend, plus health endpoint, production notes, and a 12-role access matrix.

## Local setup

Prerequisites: Node.js 22+, npm 10+, and Docker.

```bash
npm ci
docker compose up --build
```

Open `http://localhost:8080`. The frontend is a Vite React app using TanStack Router. The backend is NestJS on `http://localhost:3001`, and PostgreSQL runs in Docker on host port `54322`.

For local development outside Docker, start PostgreSQL, run migrations/seeds, and then run the frontend and API separately:

```bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run api:dev
npm run web:dev
```

## Project structure

```text
src/                 Vite React entrypoint and TanStack Router tree
apps/api/            NestJS API, guards, modules and Kysely services
components/          ERP shell, dashboard, tables and reusable UI
lib/pdf/             Branded PDF generator and template definitions
lib/export/          Excel import/export
database/migrations/ PostgreSQL schema, triggers and workflow controls
database/seeds/      Roles, permissions, departments and master data
deploy/              Nginx production configuration
docs/                Deployment and role/access documentation
```

## Verification

```bash
npm run typecheck
npm run build
docker compose config
```

Before go-live, configure the real legal address, CR/tax data, bank accounts, email provider, document terms, approval thresholds, product masters, opening stock, chart of accounts, and user-role assignments. Execute a user-acceptance cycle per department and a restore drill before importing production data.

See [production deployment](docs/PRODUCTION.md) and [role matrix](docs/ROLE_MATRIX.md).
