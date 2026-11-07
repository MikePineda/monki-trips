# Runbook

Service and variable names only: hosts, IDs and credentials live in the
deployment's environment, never here.

## Services

| Service (compose) | What                                | Health                                                |
| ----------------- | ----------------------------------- | ----------------------------------------------------- |
| `app`             | the `runtime` image (API + PWA)     | `GET /api/health` (readiness), `GET /api/health/live` |
| `db`              | Postgres 17 (`monkitrips` database) | `pg_isready -U monkitrips -d monkitrips`              |

Local and test stacks: `compose.dev.yaml` (`db`, optional `minio` under the
`s3` profile), `compose.test.yaml` (`db`, tmpfs, one project per E2E slot).

## Variables

The full list with comments is `apps/api/.env.example`. Operationally
relevant ones:

| Variable                                                                     | Notes                                                                      |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `APP_KEY`                                                                    | Secret. Rotating it signs everyone out.                                    |
| `APP_URL`                                                                    | Public URL of the deployment.                                              |
| `REGISTRATION_OPEN`                                                          | `true` only while creating the first accounts.                             |
| `MIGRATE_ON_START`                                                           | `true` with one replica; migrate out of band with several.                 |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `DB_POOL_MAX` | `DB_PASSWORD` is a secret.                                                 |
| `DRIVE_DISK`, `S3_*`                                                         | `fs` until storage is configured; `s3` requires every `S3_*` value.        |
| `MAIL_DRIVER`, `MAIL_FROM`, `RESEND_API_KEY`                                 | `log` never sends; `resend` requires the key and the sender.               |
| `LLM_PROVIDER`, `LLM_*`                                                      | `fake` needs nothing; `anthropic` requires `LLM_API_KEY` and `LLM_MODEL`.  |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`                     | Web push. All three or none; the private key is a secret.                  |
| `SCHEDULER`                                                                  | `on` (default) runs the in-process jobs; `off` on a replica that must not. |
| `APP_VERSION`, `GIT_SHA`                                                     | Leave empty: the image carries them.                                       |
| `SEED_USERS`, `SEED_*`                                                       | Reserved for the first-deploy bootstrap (WP 0.5).                          |

## Procedures

- **Is it up?** `curl -s <APP_URL>/api/health` shows `status`, `version` and
  `sha`; a 503 means the database is unreachable (see the `app` logs).
- **Boot crash loop:** the logs name the invalid or missing variables
  (`Invalid environment variables`) or the failed migration.
- **Run migrations by hand:** `node ace migration:run --force` in the
  `app` container's working directory.
- **Backups:** dump the `db` service's database daily; test a restore.
- **Enable push:** generate a VAPID pair with `node ace vapid:generate`
  (anywhere the API runs, even a laptop), paste the three variables
  (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` as a `mailto:`
  contact) in the panel, redeploy. `GET /api/v1/config` then reports
  `pushEnabled: true`; each person turns on Notifications in Settings on
  their phone (iPhone: from the installed app) and taps "Send a test".
  From the server: `node ace push:test --user <e-mail>`. Never rotate the
  pair casually: every device has to enable notifications again.
- **Scheduler:** the `app` logs show `scheduler started` with the job list
  on boot and `scheduled job failed` with the job name when one throws;
  `scheduler_runs` keeps one row per job and slot (`done` / `failed`).
- **Load a trip from a file:** dry run first, then import, from your machine
  as your own account, never from a cloud session. With the app running
  locally against your database: `node ace trip:import <file> --user <your e-mail> --dry-run`
  (prints counts and warnings, writes nothing), then the same without
  `--dry-run`. Against production use the app's import (or
  `POST /api/v1/trips/import?dryRun=true`, then `dryRun=false`) signed in as
  yourself; the file is yours, so it never goes through a cloud VM, a prompt
  or a repository. `node ace trip:export <tripId> <file>` writes a backup of
  one trip; `GET /api/v1/me/export` takes every trip of an account.
