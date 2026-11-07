# Cloud sessions

This repo is built to be worked on from Claude Code cloud sessions
(Anthropic-hosted VMs) as well as from a laptop, with the same gate. This page
explains what happens when a cloud session starts, what the environment must
provide, and how to check a new environment.

Official references: [cloud environments](https://code.claude.com/docs/en/cloud-environments),
[hooks](https://code.claude.com/docs/en/hooks),
[settings](https://code.claude.com/docs/en/settings).

## What the VM gives us

- Ubuntu 24.04 x86_64, about 4 vCPU, 16 GB RAM, 30 GB disk.
- Node 20/21/22 preinstalled (22 default). This repo needs the major in
  `.nvmrc`, so the environment's **setup script** installs that exact Node
  release from nodejs.org into `/opt/node24` (checksum verified).
- Docker with compose; Postgres 16 and Redis 7 installed but stopped.
- **Chrome for Testing** at `/usr/bin/google-chrome`, with `CHROME_PATH`.
- `gh` with a proxy-injected token: REST (`gh api`) works; `gh pr`,
  `gh issue` and every GraphQL call answer 403.
- Network level **Custom** (the dialog offers None, Limited and Full plus
  custom hosts): the Trusted defaults (npm registry, nodejs.org, Docker Hub,
  ghcr.io, raw.githubusercontent.com, Ubuntu archives…) plus the production
  host. The Playwright browser CDN is not on the list.
- A global git identity in `/root/.gitconfig` written by the harness: the
  Anthropic agent no-reply address. It beats the `--system` identity of the
  setup script, so the hook pins the owner's identity at repository scope
  (step 2 below).

What reaches the VM from the repo: `CLAUDE.md`, `.claude/settings.json`,
`.claude/{rules,skills}`. What does not: anything under the
owner's home directory, plugins, user-scope MCP servers, and gitignored
files such as `docs/internal/`.

Documentation MCP servers are not configured; use the official docs through
`WebFetch` when the environment allows the host, otherwise rely on the
repo's own docs.

## Order of events

1. **Environment setup script** (configured in the environment dialog, not
   in the repo; root; before Claude starts; cached for about 7 days):
   installs Node into `/opt/node24`, pre-pulls `postgres:17` and the
   `node:<.nvmrc>-slim` image, installs `shellcheck`, sets a `--system` git
   identity (GitHub no-reply address; overridden by the harness, see step 2
   of the hook) and writes two non-personal preferences to the VM's user
   `CLAUDE.md`. It always exits 0. Upload it in the dialog as a file: pasting
   it once broke on a quote.
2. **SessionStart hook** (`.claude/settings.json`, matcher `startup|resume`,
   timeout 600 s) runs `scripts/cloud-setup.sh`.
3. Claude starts with the hook's status lines in its context.

## What `scripts/cloud-setup.sh` does

It exits immediately unless `CLAUDE_CODE_REMOTE` is `true`, so it is a no-op
on laptops. It never fails the session: every step only reports, and it
always exits 0. Details go to `.claude/cloud-setup.log` (gitignored).

| Step | What                                                                                                                                                                                                                                                                                                                         | Status line                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1    | Puts `/opt/node24/bin` first on `PATH` and exports `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, `CHROME_PATH` (default `/usr/bin/google-chrome`) and `E2E_WORKERS=2` through `CLAUDE_ENV_FILE`, so every later Bash command sees them. Checks the Node major against `.nvmrc` and that Chrome exists.                               | `node vX, npm Y` / `chrome: …`         |
| 2    | Pins the git identity at repository scope (`git config user.name/user.email`) to the no-reply address of the account behind `gh`: `<id>+<login>@users.noreply.github.com` from `gh api user`. The harness identity in `/root/.gitconfig` then only appears in co-author trailers. Skipped on GitHub Actions (no user token). | `git identity: <login> (no-reply)`     |
| 3    | `npm ci --ignore-scripts` + `npm rebuild --strict-allow-scripts` (the CI install) only when the sha256 stamp of the lockfile, every `package.json`, `.nvmrc`, `.npmrc` or the script itself changed; then installs the git hooks. Runs the lockfile guard (warning only).                                                    | `deps: installed` / `deps: up to date` |
| 4    | Creates `apps/api/.env` from `.env.example` and runs `node ace generate:key` on a fresh clone.                                                                                                                                                                                                                               | `.env: created`                        |
| 5    | Starts Postgres: Docker `compose.dev.yaml` service `db` (postgres:17 on `127.0.0.1:5432`) first; if Docker fails, the system Postgres 16 with `docker/postgres/fallback.sql`. Containers do not survive an idle pause; the `resume` run restarts them.                                                                       | `db: …`                                |
| 6    | Reports whether `PRIVACY_PATTERNS` is set (never its value).                                                                                                                                                                                                                                                                 | `privacy: …`                           |

Any line starting with `WARN` needs attention; CI's `cloud-parity` job runs
the same script on a GitHub runner and fails on any `WARN`.

## Why Chromium comes from `CHROME_PATH`

Playwright normally downloads its own browsers from its CDN, which is not on
the cloud allowlist. The VM already ships Chrome for Testing, so the hook
sets `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and the Playwright config launches
Chromium from `CHROME_PATH`. WebKit has no system build: it runs only in CI
(`e2e-webkit`). CI's `e2e` job uses Playwright's own Chromium; `cloud-parity`
uses the runner's system Chrome the way the VM does.

## Tests never touch the internet

- `scripts/test/no-network.mjs` is imported first by every test entry point
  (Japa, Vitest `setupFiles`, `node:test`). It allows loopback, unix sockets
  and the hosts in `NO_NETWORK_ALLOW_HOSTS`; anything else fails with
  `no-network: blocked <host>`. External providers always have fakes.
- `scripts/test-offline.sh` is the strong check: the suite runs in
  `node:<.nvmrc>-slim` on a Docker network created with `--internal`, next to
  a throwaway `postgres:17` on tmpfs. It runs in `cloud-parity` and in the
  first-session smoke. Linux hosts only.

## Pull requests from a cloud session

The owner launches cloud sessions from a terminal and follows them through
their PRs (a laptop session cannot drive one: `claude --cloud` needs a TTY).
Only the master agent opens and merges PRs, through `gh api` (REST): see
`.claude/rules/master-agent.md` and the `ship` skill
(`.claude/skills/ship/scripts/`). `attribution.sessionUrl` is `false`, so
commits and PR bodies carry no link to the private session transcript.
Branches cannot be deleted through the proxy; the repo deletes them on merge.

## Environment variables (names only)

Set these in the environment dialog. Values live in the owner's private
notes, never in the repo.

| Name                                              | Purpose                                                                           | Secret                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------- |
| `BASH_DEFAULT_TIMEOUT_MS`, `BASH_MAX_TIMEOUT_MS`  | longer Bash timeouts for builds and E2E                                           | no                            |
| `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`, `E2E_WORKERS` | E2E in the VM (the hook sets them too)                                            | no                            |
| `TURBO_TELEMETRY_DISABLED`, `NG_CLI_ANALYTICS`    | no telemetry calls                                                                | no                            |
| `SMOKE_BASE_URL`                                  | production base URL for the post-deploy checks                                    | no, but personal: only here   |
| `PRIVACY_PATTERNS`                                | the owner's patterns as one ERE line (`a\|b\|c`), enables the full pre-push check | sensitive: **never print it** |

The suite itself needs no secret: `apps/api/.env.test` holds fake values.

## First-session smoke checklist

Run once per new environment (and after changing its setup script); record
results in `docs/QA.md` § Cloud smoke, without personal values.

| #   | Check                                                                                                                                                        | Expected                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | `gh api user --jq .login`; `echo "$GH_TOKEN"`                                                                                                                | the repository owner's handle; `proxy-injected`                                                                                                                                    |
| S2  | `node -v`; `npm -v`; `command -v node`                                                                                                                       | the `.nvmrc` version; npm ≥ 11.19; `/opt/node24/bin` or `/usr/local/bin`                                                                                                           |
| S3  | hook output in context; `.claude/cloud-setup.log` and `node_modules/.cloud-setup.sha256` exist                                                               | after a resume the hook says `deps: up to date`                                                                                                                                    |
| S4  | `docker info`; `docker images postgres:17`                                                                                                                   | Docker answers; the image is there without a pull                                                                                                                                  |
| S5  | `docker run -d --rm -p 127.0.0.1:55432:5432 -e POSTGRES_PASSWORD=x postgres:17`, then `pg_isready -h 127.0.0.1 -p 55432`                                     | accepting connections                                                                                                                                                              |
| S6  | `docker network create --internal t && docker network rm t`; `bash scripts/test-offline.sh`                                                                  | both succeed; suite green offline                                                                                                                                                  |
| S7  | `npm run verify:quick`                                                                                                                                       | green; note the duration                                                                                                                                                           |
| S8  | `npm run e2e -- -- --project=mobile-chromium`                                                                                                                | green with Chrome for Testing, no browser download                                                                                                                                 |
| S9  | empty commit on a local branch: `git log -1 --format='%an <%ae> \| %cn <%ce> \| %b'`; `bash scripts/ci/check-commits.sh origin/main HEAD`; delete the branch | the hook said `git identity: … (no-reply)`; author and committer are `<id>+<login>@users.noreply.github.com` (not the Anthropic address); no `Claude-Session` trailer; check green |
| S10 | `/mcp`                                                                                                                                                       | no project MCP server listed (`.mcp.json` was removed)                                                                                                                             |
| S11 | `[ -n "$PRIVACY_PATTERNS" ] && echo set`; `bash scripts/ci/privacy-pre-push.sh`                                                                              | `set`; the check reports a personal-pattern count above 0                                                                                                                          |
| S12 | `gh api "repos/$REPO/rules/branches/main" --jq '.[].type'`                                                                                                   | includes `pull_request` and `required_status_checks`                                                                                                                               |
| S13 | `nproc`; `free -g`; `df -h /`                                                                                                                                | about 4 / 16 / 30                                                                                                                                                                  |
| S14 | after a deploy: `curl -fsS -A 'Mozilla/5.0' "$SMOKE_BASE_URL/api/health"`                                                                                    | `status` ok with the deployed version and sha; runnable only after the first deploy (before it the host does not resolve)                                                          |

`$REPO` is `<owner>/<repo>` from the origin remote (the ship scripts derive
it the same way).

## Troubleshooting

- **`WARN node major …`**: the setup script did not install Node (its log is
  in `/tmp/setup-node.log` on the VM). Rerun it by editing the environment, or
  install by hand for this session and record a LESSONS line.
- **`WARN deps: npm ci failed`**: read `.claude/cloud-setup.log`. A registry
  hiccup: rerun `bash scripts/cloud-setup.sh` with `CLAUDE_CODE_REMOTE=true`.
  A missing native build: the lockfile guard names it; regenerate the lockfile
  on a clean tree.
- **`WARN lockfile guard failed`**: an install script without an
  `allowScripts` decision, a tarball outside the npm registry, or a native
  family without linux builds. Fix the lockfile; CI fails on it too.
- **`WARN db: …`**: `docker info` fails → start `dockerd` (the hook tries
  for 30 s). Port 5432 busy → `docker compose -f compose.dev.yaml down` or
  `service postgresql stop`, then rerun the hook script.
- **`no-network: blocked <host>`** in a test: code under test reached for the
  internet. Use the fake provider; never add public hosts to
  `NO_NETWORK_ALLOW_HOSTS`.
- **E2E cannot find a browser**: `echo "$CHROME_PATH"` and
  `ls -l /usr/bin/google-chrome`; never run `playwright install` in the VM.
- **`gh` 403 "GraphQL is not available"**: use the REST equivalent
  (`gh api repos/$REPO/...`); the ship scripts already do.
- **After an idle pause** background processes, containers and running
  subagents are gone: the `resume` hook restarts Postgres; the master rereads
  `docs/BACKLOG.md`, `git log` and the open PRs before continuing.
- **`WARN git identity: …`**: `gh api user` failed, so commits would carry
  the harness's agent identity. Check `gh api user --jq .login`; then rerun
  the hook script with `CLAUDE_CODE_REMOTE=true`, or set `user.name` and
  `user.email` repo-locally to the no-reply address before committing.
