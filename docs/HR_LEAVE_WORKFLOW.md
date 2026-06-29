# HR Leave Workflow

The HR leave workspace is the main API-backed workflow in the current app. It connects React UI, NestJS endpoints, Kysely services, PostgreSQL tables/triggers, local document storage, and PDF generation.

## User Flow

Open the app, choose `People & HR`, then select the `Leave` tab.

The workspace includes:

- Annual Planner
- Applications
- Approvals
- Job Handover
- Clearance
- Rejoin

Users can create and edit leave applications, submit drafts, approve or reject pending approvals, manage job handover notes/attachments, update clearance state, record rejoin status, upload supporting files, export visible data to Excel, and generate leave PDFs.

## Frontend Entry Points

| File | Responsibility |
|---|---|
| `components/module-workspace.tsx` | Routes the HR `Leave` tab into the connected leave workspace. |
| `components/hr-leave-workspace.tsx` | Owns HR leave UI state, filtering, sorting, modals, API calls, exports, uploads, and workflow actions. |
| `lib/api-client.ts` | Sends API requests, sets `x-dev-user`, handles JSON errors, downloads blobs. |
| `lib/validation.ts` | Defines Zod schemas for leave application and workflow updates. |
| `lib/hr/leave-types.ts` | Frontend TypeScript types for leave records and form values. |

## API Endpoints

All HR leave endpoints are under `/hr` and use `DevAuthGuard`, `PermissionGuard`, and a default `hr:view` requirement.

| Method | Path | Purpose | Permission |
|---|---|---|---|
| `GET` | `/hr/leave-workspace` | Load applications, approvals, handovers, clearances, rejoins, and employee options. | `hr:view` |
| `GET` | `/hr/leave-applications` | List leave applications. | `hr:view` |
| `POST` | `/hr/leave-applications` | Create a draft or submitted leave application. | `hr:create` |
| `PATCH` | `/hr/leave-applications/:id` | Update a draft or submitted application. | `hr:update` |
| `PATCH` | `/hr/leave-applications/:id/submit` | Submit a draft application. | `hr:create` |
| `PATCH` | `/hr/leave-applications/:id/cancel` | Cancel an eligible application. | `hr:update` |
| `PATCH` | `/hr/leave-applications/:id/decision` | Approve or reject a pending application. | `hr:approve` |
| `POST` | `/hr/leave-applications/:id/pdf` | Generate a leave PDF for an application. | `hr:view` |
| `GET` | `/hr/documents?key=...` | Download a stored generated/uploaded document. | `hr:view` |
| `GET` | `/hr/leave-handovers` | List handovers. | `hr:view` |
| `PATCH` | `/hr/leave-handovers/:id` | Update handover notes/status. | `hr:update` |
| `POST` | `/hr/leave-handovers/:id/attachment` | Upload handover attachment. | `hr:update` |
| `GET` | `/hr/leave-clearances` | List clearances. | `hr:view` |
| `PATCH` | `/hr/leave-clearances/:id` | Update clearance status/items. | `hr:update` |
| `GET` | `/hr/leave-rejoins` | List rejoins. | `hr:view` |
| `PATCH` | `/hr/leave-rejoins/:id` | Update rejoin status/date. | `hr:update` |
| `POST` | `/hr/leave-rejoins/:id/attachment` | Upload rejoin supporting attachment. | `hr:update` |

## Status Model

Applications:

- `draft`
- `submitted`
- `pending_approval`
- `approved`
- `rejected`
- `cancelled`

Approvals:

- `pending`
- `approved`
- `rejected`

Handovers:

- `pending`
- `accepted`
- `cancelled`

Clearances:

- `not_required`
- `pending`
- `in_progress`
- `cleared`
- `blocked`

Rejoins:

- `pending_rejoin`
- `rejoined_on_time`
- `delayed_rejoin`
- `no_show`
- `verified`

## Database Behavior

The workflow is backed by `database/migrations/0003_hr_leave.sql`.

Important database responsibilities:

- Validate application date order and travel date order.
- Prevent overlapping approved leave for the same employee.
- Prevent handover to the same employee.
- Resolve an approver from the employee manager, HR manager, management, super admin, or creator fallback.
- Sync submitted applications into pending approval records.
- Apply approval decisions to the application and leave balance.
- Create handover, clearance, and rejoin records from approved applications.
- Normalize rejoin status based on original and actual return dates.

Because several downstream records are trigger-driven, service code should not duplicate the synchronization logic unless the database contract changes intentionally.

## Documents and PDFs

Uploads and generated documents are stored through `DocumentsStorageService`.

- `LOCAL_STORAGE_ROOT` controls the storage root.
- Docker uses `/data/storage` mounted to the `medtech_storage` volume.
- Local development defaults to `.local-storage` from `.env.example`.
- Handover and rejoin uploads use multipart field name `file`.
- Leave PDF generation is handled by `apps/api/src/hr/leave-pdf.service.ts`.

## Extension Rules

- Keep frontend schemas in `lib/validation.ts` aligned with API DTO behavior and database constraints.
- Keep workflow status names consistent across Zod schemas, TypeScript types, SQL constraints, and UI filters.
- If new columns are added, update SQL migrations, apply them, regenerate `database/generated/db.ts`, and update service/frontend types.
- If new actions are added, add or reuse explicit permissions and enforce them in the controller.
