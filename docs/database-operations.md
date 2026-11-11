# PostgreSQL operating guide

Status: development foundation active, updated 2026-11-11. The separate PostgreSQL 18.6 setup and migrations 001–002 are complete; production recovery and deployment decisions remain open.

## Local discovery

The workstation has PostgreSQL 17.5 binaries under `C:\Program Files\PostgreSQL\17\bin`. They are not available through the current shell PATH. A readiness probe received no response from `127.0.0.1:5432`; this does not establish whether another port or remote instance is in use. Service enumeration was denied by the current environment.

The approved implementation targets PostgreSQL 18. The owner approved a separate PostgreSQL 18 setup on 2026-10-26. Do not start, upgrade, reconfigure or delete an existing cluster to satisfy this project.

## Environment separation

Create a dedicated KNEC development instance and a separately designated disposable test database. Use distinct migration and runtime roles. The application must never connect as a database superuser. Keep passwords and connection strings out of Git, screenshots and presentation material.

Migrations will use `DATABASE_MIGRATION_URL`; the running application will use `DATABASE_URL`; synthetic checks will use `TEST_DATABASE_URL`. Runtime startup verifies schema compatibility but does not apply migrations. Test cleanup must reject runtime targets and unmarked databases.

## Required implementation evidence

- Numbered migrations with checksums and serialization of concurrent migration commands.
- Runtime role restricted to required table/sequence operations.
- Parameterized queries, short transactions and bounded connection/query/lock waits.
- Verified TLS for remote connections; loopback-only non-TLS allowed explicitly for local development.
- Restart and independent-process duplicate/worker coordination checks.
- Synthetic backup restored into a fresh isolated database and inspected before acceptance.

## Recovery and future production

Document backup ownership, schedule, retention, recovery-time and recovery-point objectives before production deployment. Backup creation alone is insufficient: restore exercises must demonstrate usability. Production point-in-time recovery and availability arrangements require a deployment decision. Never restore over a running database during an exercise.

Phase 4 initially stores minimal messaging receipts, jobs, attempts and callbacks. Conversation sessions, knowledge publication and departmental workflows require later reviewed migrations. This database does not grant access to official KNEC records.

Setup commands and operating evidence are recorded below.


## Local setup checkpoint — 2026-10-27

PostgreSQL **18.6** was downloaded from the Windows archive linked by the official PostgreSQL website and initialized separately under the parent project's `.knec-postgresql18` directory. The existing PostgreSQL 17 installation was preserved. The dedicated instance listens on **127.0.0.1:55418** and uses SCRAM password authentication. The setup directory has restricted Windows access permissions.

- Development database: `knec_development`.
- Disposable test database: `knec_disposable_test_phase4`.
- Roles: `knec_migration` owns the development schema; `knec_runtime` has schema usage, table DML and migration-history read access; `knec_test` owns only the disposable test database. The bootstrap administrator is reserved for local provisioning.
- Generated connection values are in the restricted setup directory, outside the repository. Do not display that file or include it in a presentation.
- Migrations 1 and 2 applied successfully. The `conversation` schema contains `sessions`, `events`, `outbox` and `callbacks`. Runtime schema usage and table DML were granted; denial of schema CREATE was checked.
- A logical development backup was restored into a newly created isolated database and its migration version was checked. This first exercise contains no real messages and does not establish production recovery objectives or populated-message recovery coverage.

### Start and stop the dedicated instance

From the repository in PowerShell:

```powershell
$pgRoot = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) '..\.knec-postgresql18'))
& (Join-Path $pgRoot 'core\pgsql\bin\pg_ctl.exe') -D (Join-Path $pgRoot 'data') -l (Join-Path $pgRoot 'server.log') -o '-h 127.0.0.1 -p 55418' -w start
# Stop only this instance after application workers have stopped:
& (Join-Path $pgRoot 'core\pgsql\bin\pg_ctl.exe') -D (Join-Path $pgRoot 'data') -m fast -w stop
```

This is a local development process, not an automatically installed Windows service. Recheck readiness after a machine/session interruption.

### Migrate and verify

Supply the private migration URL in DATABASE_MIGRATION_URL, then run `npm run db:migrate`. The command serializes concurrent migration attempts and checks stored checksums. It does not load the application's private dotenv file. Apply grants for the runtime role after initial schema creation; never substitute the migration role for runtime access.

Supply TEST_DATABASE_URL for a loopback database whose name starts with `knec_disposable_test_`, then run `npm run check` or `npm run test:database`. Tests erase only the dedicated fixture schema and migration table. They fail if the test connection is absent; they do not silently skip database coverage. CI provisions its own disposable PostgreSQL service.

Pool limit: 4; acquisition timeout: 3 seconds; statement timeout: 5 seconds; lock timeout: 1 second; idle transaction timeout: 5 seconds. Remote TLS verifies certificates and hostnames; URL query parameters cannot disable this policy. The current runtime uses the system trust store.

### Conversation runtime controls

`TWILIO_CONVERSATION_ENABLED=false` is the safe default. Set it to `true` only in the controlled development Sandbox configuration to select the Phase 5 runtime. `TWILIO_CONVERSATION_TTL_SECONDS` controls session expiry (60–2,592,000 seconds) and `TWILIO_CONVERSATION_POLL_MS` controls the response-worker interval (100–60,000 ms). Live provider submission still requires the independent `TWILIO_LIVE_SEND_ENABLED=true` switch.

Turning conversation mode off stops new Phase 5 processing but does not erase records. If a send outcome is `uncertain`, inspect it and the provider console; do not reset it to pending or resend automatically. Stop the application before stopping PostgreSQL. A schema rollback is not automatic because dropping migration 002 would destroy evidence; recovery is forward-only unless an explicitly reviewed restore plan is approved.

### Backup and isolated restore

Use PostgreSQL 18 `pg_dump -Fc` with private PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE values supplied through the process environment. Keep the archive in restricted local storage. Create a fresh restore database explicitly, then use `pg_restore --no-owner --no-privileges --exit-on-error -d <isolated_database> <archive>`. Never overwrite the development or live database for an exercise. Verify schema history and representative records; restore runtime grants separately. Record retention and an authorized cleanup decision for restore databases and archives.
