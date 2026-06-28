# Production deployment

## 1. Server baseline

Use Ubuntu 24.04 LTS or equivalent with Docker Engine 26+, Docker Compose v2, at least 4 vCPU, 8 GB RAM, encrypted SSD storage, a static IP, firewall rules for 22/80/443, and DNS for `erp.medtech.qa`. Restrict SSH to key-based authentication and the administration network.

## 2. PostgreSQL

Run the managed PostgreSQL service approved for production, or use the Compose PostgreSQL service for smaller controlled deployments. Apply schema changes only through versioned SQL files in `database/migrations/`, and seed controlled baseline data from `database/seeds/`.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0001_core.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0002_business.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0003_hr_leave.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seeds/0001_roles_permissions.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seeds/0002_master_data.sql
```

Create the first local identity in `profiles`, then assign `super_admin` in `public.user_roles`. Replace `AUTH_MODE=local` with the production authentication integration before go-live.

## 3. Application environment

Set `DATABASE_URL`, `AUTH_MODE`, `LOCAL_STORAGE_ROOT`, and `PORT` for the API container. Generate any application secrets with a cryptographically secure secret manager. Do not bake secrets into the container image.

## 4. TLS and startup

Place the issued certificate and private key at `deploy/certs/fullchain.pem` and `deploy/certs/privkey.pem`. For automated renewal, use Certbot on the host and reload Nginx after renewal.

```bash
docker compose build --pull
docker compose up -d
docker compose ps
curl -fsS https://erp.medtech.qa/api/health
```

Run containers as a dedicated service account. Pin image digests in regulated environments. Forward container logs to the company SIEM and alert on authentication failures, permission changes, RLS errors, repeated upload rejection, and abnormal exports.

## 5. Backups and recovery

- Database: daily encrypted logical backup, continuous point-in-time recovery where supported, 30-day operational retention, 12 monthly archives, and an off-site copy.
- Storage: nightly incremental backup of the configured document storage volume with quarterly archive.
- Secrets/config: encrypted backup in the company secrets manager; never in source control.
- Recovery: quarterly restore drill into an isolated project. Verify row counts, critical document links, role assignments, and audit continuity. Record recovery time and recovery point objectives.

Example database backup:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --file="medtech-$(date +%F).dump"
sha256sum medtech-*.dump > checksums.txt
```

## 6. Release procedure

Test migrations on staging using a production-shaped snapshot with sensitive data masked. Take a fresh backup, deploy migrations, deploy the immutable application image, run the health check and smoke tests, then monitor errors and database load. Database migrations must be backward-compatible for rolling deployments; destructive cleanup is a separate later release.
