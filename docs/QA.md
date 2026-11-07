# Decisions and checks

Versioned decisions log (no personal data). Newest first within each date.

## Decisions

| Date       | Decision                                                                                                                                                       | Why                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 2026-11-07 | Default UI and error language is English; the web follows the device on first run (`es-*` -> es) and remembers the choice.                                     | Owner decision; supersedes Spanish as default.                       |
| 2026-11-07 | Driver credentials (`S3_*`, `RESEND_API_KEY`/`MAIL_FROM`, `LLM_API_KEY`/`LLM_MODEL`) may ship empty while the driver is off and become required when it is on. | Production starts with `DRIVE_DISK=fs` and fills storage in later.   |
| 2026-11-07 | `compose.dev.yaml` host port comes from `DB_PORT` (default 5432).                                                                                              | Other local Postgres instances often hold 5432.                      |
| 2026-11-07 | `DB_PASSWORD` is a required secret.                                                                                                                            | Every supported Postgres setup (compose, self-host) has a password.  |
| 2026-11-07 | Health check payload is `checks.db` only (no memory heap check).                                                                                               | Contract of the brief; heap pressure shows in container metrics.     |
| 2026-11-07 | No `<meta name="theme-color">` in `index.html` yet.                                                                                                            | Hex colours live only in `styles.css` and the manifest.              |
| 2026-11-07 | Auth guard deferred to WP 0.5; the cookie session store is configured now.                                                                                     | A session guard needs the users table.                               |
| 2026-11-07 | Every external provider has a `fake` and tests use it (`apps/api/.env.test`, `e2e/e2e.env`).                                                                   | The suite must never need the internet; the E2E fixture enforces it. |

## Cloud smoke

Filled by the first cloud session (WP 0.2). One row per check, no personal data.

| Check | Expected | Result | Date |
| ----- | -------- | ------ | ---- |
