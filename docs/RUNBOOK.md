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

| Variable                                                                     | Notes                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `APP_KEY`                                                                    | Secret. Rotating it signs everyone out.                                   |
| `APP_URL`                                                                    | Public URL of the deployment.                                             |
| `REGISTRATION_OPEN`                                                          | `true` only while creating the first accounts.                            |
| `MIGRATE_ON_START`                                                           | `true` with one replica; migrate out of band with several.                |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `DB_POOL_MAX` | `DB_PASSWORD` is a secret.                                                |
| `DRIVE_DISK`, `S3_*`                                                         | `fs` until storage is configured; `s3` requires every `S3_*` value.       |
| `MAIL_DRIVER`, `MAIL_FROM`, `RESEND_API_KEY`                                 | `log` never sends; `resend` requires the key and the sender.              |
| `LLM_PROVIDER`, `LLM_*`                                                      | `fake` needs nothing; `anthropic` requires `LLM_API_KEY` and `LLM_MODEL`. |
| `APP_VERSION`, `GIT_SHA`                                                     | Leave empty: the image carries them.                                      |
| `SEED_USERS`, `SEED_*`                                                       | Reserved for the first-deploy bootstrap (WP 0.5).                         |

## Procedures

- **Is it up?** `curl -s <APP_URL>/api/health` shows `status`, `version` and
  `sha`; a 503 means the database is unreachable (see the `app` logs).
- **Boot crash loop:** the logs name the invalid or missing variables
  (`Invalid environment variables`) or the failed migration.
- **Run migrations by hand:** `node ace migration:run --force` in the
  `app` container's working directory.
- **Backups:** dump the `db` service's database daily; test a restore.
