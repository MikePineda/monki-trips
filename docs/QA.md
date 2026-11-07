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

| Check | Expected                                                   | Result | Evidence                                                                                                                                                                                                                                                                                             | Date       |
| ----- | ---------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| S1    | owner's handle; `proxy-injected`                           | PASS   | `gh api user` login equals the owner of the origin URL; `GH_TOKEN=proxy-injected`                                                                                                                                                                                                                    | 2026-11-07 |
| S2    | `.nvmrc` version, npm ≥ 11.19, `/opt/node24/bin`           | PASS   | node v24.20.0, npm 11.19.0, `/opt/node24/bin/node` first on PATH                                                                                                                                                                                                                                     | 2026-11-07 |
| S3    | hook output in context, log and stamp exist                | PASS   | hook ran by itself at startup, 6 `cloud-setup:` lines, no `WARN`; `.claude/cloud-setup.log` and `node_modules/.cloud-setup.sha256` exist; `npm ci` took 16 s                                                                                                                                         | 2026-11-07 |
| S4    | Docker answers; image present without a pull               | PASS   | dockerd running, Docker 29.9.2, Compose v5.6.1, overlayfs; `postgres:17` and `node:24.20.0-slim` already present                                                                                                                                                                                     | 2026-11-07 |
| S5    | accepting connections                                      | PASS   | `-p 127.0.0.1:55432:5432` → `pg_isready` accepting after ~1 s; container removed                                                                                                                                                                                                                     | 2026-11-07 |
| S6    | `--internal` network; suite green offline                  | PASS   | network create/rm ok; `test-offline.sh` green in 11 s (api 53, web 46)                                                                                                                                                                                                                               | 2026-11-07 |
| S7    | green; duration                                            | PASS   | 14/14 tasks; 9 s with 3 turbo cache hits, 14 s with `TURBO_FORCE=1`                                                                                                                                                                                                                                  | 2026-11-07 |
| S8    | green with Chrome for Testing, no download                 | PASS   | 3 passed, 2 workers, slot 0, 14 s; Chrome for Testing 153 from `CHROME_PATH`; no `~/.cache/ms-playwright`                                                                                                                                                                                            | 2026-11-07 |
| S9    | GitHub no-reply identity, no `Claude-Session`; check green | FAIL   | probe commit got the Anthropic agent no-reply identity from `/root/.gitconfig`, which overrides the setup script's `/etc/gitconfig` no-reply identity; no `Claude-Session` trailer; `check-commits.sh` green (it allows the Anthropic address); this session set repo-local `user.*` from `--system` | 2026-11-07 |
| S10   | context7 listed and answering                              | FAIL   | tools loaded; `resolve-library-id` for Angular: "Monthly quota exceeded. Create a free API key…"                                                                                                                                                                                                     | 2026-11-07 |
| S11   | `set`; personal-pattern count > 0                          | PASS   | `set`; `privacy-check.sh` and `privacy-pre-push.sh`: 1 personal pattern, 186 files clean                                                                                                                                                                                                             | 2026-11-07 |
| S12   | `pull_request` and `required_status_checks`                | PASS   | rules: deletion, non_fast_forward, required_linear_history, pull_request, required_status_checks; `gh pr list` 403 (GraphQL); `gh api …/pulls` works                                                                                                                                                 | 2026-11-07 |
| S13   | about 4 / 16 / 30                                          | PASS   | `nproc` 4; `free -g` 15 total; `df -h /` 252G size, 29G available (the per-session allowance)                                                                                                                                                                                                        | 2026-11-07 |
| S14   | `status` ok with version and sha                           | SKIP   | DNS not set yet: `$SMOKE_BASE_URL` host does not resolve in the VM and the proxy answers CONNECT 502                                                                                                                                                                                                 | 2026-11-07 |

VM facts (first session, 2026-11-07): `nproc` 4; `free -g` 15 GB total,
0 swap; `df -h /` 252G size, 11G used, 29G available; node v24.20.0, npm
11.19.0, `command -v node` → `/opt/node24/bin/node`; Docker 29.9.2 (client
and server), Compose v5.6.1; Chrome for Testing 153 at
`/usr/bin/google-chrome`; `CHROME_PATH`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
and `E2E_WORKERS=2` exported by the hook.

SessionStart hook output received as context:

```
node v24.20.0, npm 11.19.0
chrome: /usr/bin/google-chrome
deps: installed
.env: created
db: docker postgres:17 on 127.0.0.1:5432
privacy: patterns set (pre-push runs the full check)
```
