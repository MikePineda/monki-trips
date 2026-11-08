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
| `LLM_PROVIDER`, `LLM_*`                                                      | See "LLM" below. `anthropic` requires `LLM_API_KEY` and `LLM_MODEL`.       |
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
- **LLM: provider, model and cap variables; cost query.**
  - `LLM_PROVIDER=anthropic` for any Anthropic Messages compatible endpoint.
    `LLM_BASE_URL` is the endpoint's origin without `/v1/messages` (empty =
    Anthropic; for MiniMax, its Anthropic-compatible base URL from the
    provider's docs). `LLM_API_KEY` is a secret. `LLM_MODEL` is the model id
    the endpoint expects; `LLM_VISION_MODEL` (optional) takes requests that
    carry an image. `fake` answers 503 in production (no fixtures in the
    image); `openai` is a reserved seam that answers 503.
  - Cap: tokens per account and UTC month from `config/plans.ts` (`free`,
    `pro`; `node ace users:plan <e-mail> pro` moves an account), or
    `LLM_MONTHLY_TOKEN_CAP_OVERRIDE` for every account. Over it the API
    answers 402 `E_LLM_QUOTA_EXCEEDED`; `GET /api/v1/auth/me` reports
    `llmTokensLeft`.
  - Usage and cost: `node ace llm:usage` (this month) or
    `node ace llm:usage --month 2027-01` prints calls, tokens, cap and cost
    per account (ids and masked addresses). In SQL:
    `SELECT user_id, count(*), sum(tokens_in), sum(tokens_out), sum(cost_micros) / 1e6 AS usd FROM llm_usage WHERE created_at >= date_trunc('month', now() at time zone 'utc') GROUP BY user_id ORDER BY 3 DESC;`
    A null `cost_micros` means the model is missing from the price table in
    `config/llm.ts`: add it there. Many `error` rows mean the provider is
    failing (check the key, the base URL and the model id); the logs carry
    the status, never the prompt.

## Inspect sent reminders

The `push:reminders` job records every reminder in `sent_reminders` before
it sends it (one row per account, kind, ref and nominal fire time, the
time before quiet hours), so the table answers "did it go out, and when".
A row whose send reached no device for a transient reason is deleted and
retried the next minute. Rows hold ids only, never titles.

```sql
-- The last reminders sent, newest first.
SELECT sent_at, fire_at, kind, ref_id, trip_id, user_id
FROM sent_reminders ORDER BY sent_at DESC LIMIT 50;

-- Reminders per kind and day this week.
SELECT date_trunc('day', sent_at) AS day, kind, count(*)
FROM sent_reminders WHERE sent_at >= now() - interval '7 days'
GROUP BY 1, 2 ORDER BY 1 DESC, 2;

-- Sent late (more than two minutes after the planned time; a reminder moved
-- by quiet hours shows its move here too).
SELECT kind, ref_id, fire_at, sent_at - fire_at AS delay
FROM sent_reminders WHERE sent_at - fire_at > interval '2 minutes'
ORDER BY sent_at DESC;

-- What one account received (its id from the users table).
SELECT * FROM sent_reminders WHERE user_id = '<user id>' ORDER BY fire_at DESC;
```

- A person's own choices and quiet hours are in `notification_settings`
  (no row = every reminder, no quiet hours); `GET /api/v1/me/reminders/upcoming`
  signed in as them lists what is planned for the next 36 hours.
- The job only runs when push is enabled (VAPID keys set); its runs are in
  `scheduler_runs` (`job = 'push:reminders'`, one row per minute).
- **Stop all reminders:** set `SCHEDULER=off` and redeploy; the scheduler
  stops ticking on every replica (the daily `push:prune` stops too). Due
  reminders older than 15 minutes are skipped when it is turned back on, so
  re-enabling never floods devices.
