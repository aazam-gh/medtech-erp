# MedTech ERP

MedTech ERP is a TypeScript/Node enterprise resource planning application for MedTech Corporation Trading W.L.L. It combines a Vite React frontend, a NestJS API, PostgreSQL data access through Kysely, SQL migrations/seeds, document storage, and PDF/Excel foundations.

The product shell covers finance, HR, sales, procurement, inventory, shipping, service, projects, documents, approvals, reports, and administration. The broad module navigation currently uses local scaffold data, while the HR leave workspace is the main connected end-to-end workflow backed by the API and PostgreSQL.

## Quick Start

Prerequisites: Node.js 22+, npm 10+, Docker, and PostgreSQL client tools when using the local database scripts.

```bash
npm ci
cp .env.example .env.local
docker compose up --build
```

Open `http://localhost:8080`. The Docker stack runs PostgreSQL on host port `54322`, the API on `http://localhost:3001`, and the web app through Nginx on `http://localhost:8080`.

For split local development:

```bash
npm ci
cp .env.example .env.local
npm run db:up
npm run db:wait
npm run db:migrate
npm run db:seed
npm run api:dev
npm run web:dev
```

The Vite dev server runs on `http://localhost:5173`, the preview server on `http://localhost:4173`, and the API health check is `http://localhost:3001/health`.

## Documentation

- [Getting started](docs/GETTING_STARTED.md): local setup, environment, Docker, reset, and common startup problems.
- [Architecture](docs/ARCHITECTURE.md): frontend, API, auth, permissions, data access, and current implementation boundaries.
- [Database](docs/DATABASE.md): migration order, seeds, generated Kysely types, document sequences, audit triggers, and schema conventions.
- [HR leave workflow](docs/HR_LEAVE_WORKFLOW.md): implemented leave application, approval, handover, clearance, rejoin, attachment, and PDF behavior.
- [Development guide](docs/DEVELOPMENT_GUIDE.md): how to extend the app safely and what to validate before handoff.
- [Production deployment](docs/PRODUCTION.md): production server, TLS, backup, and release notes.
- [Role matrix](docs/ROLE_MATRIX.md): business roles, approval authority, and sensitive restrictions.
- [Agent instructions](AGENTS.md): repository-specific instructions for coding agents.

## Project Structure

```text
src/                 Vite React entrypoint and TanStack Router route tree
components/          ERP shell, dashboard, module workspaces, and reusable UI
lib/                 Shared frontend/client helpers, validation, PDF, export, and static ERP data
apps/api/            NestJS API, auth guards, modules, services, and Kysely provider
database/migrations/ Versioned PostgreSQL schema and trigger SQL
database/seeds/      Baseline roles, permissions, company, employee, and master data
database/generated/  Kysely database types generated from the live schema
templates/           Source templates used by document/PDF workflows
deploy/              Nginx production configuration
docs/                Maintainer, workflow, deployment, and access documentation
```

## Validation

Use the existing npm scripts unless a task requires a narrower check:

```bash
npm run typecheck
npm run lint
npm run build
docker compose config
```

Run `docker compose config` when Docker, deployment, or Compose behavior is touched.
