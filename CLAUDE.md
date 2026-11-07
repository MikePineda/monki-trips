# monki-trips: agent rules

Offline-first travel PWA for people travelling together: itinerary, where we
sleep, documents, tasks and budget, usable without a connection. Open source
(AGPL-3.0-only), multi-user from day one, self-hostable with one compose file.
Read this file first, then `docs/ARCHITECTURE.md` and `docs/CONTRACTS.md`.

**Decisions live in `docs/QA.md`** (versioned, no personal data).
`docs/internal/` is gitignored owner scratch (plans with names, the real trip
data): never copy anything from it into a tracked file, and it does not exist
in a fresh clone or a cloud session.

New ideas mid-session go to `docs/BACKLOG.md` as a dated one-liner, then you
continue. Anything that did not work as written goes to `docs/LESSONS.md` as
a dated one-liner (what, where: laptop/cloud/CI, what changed).

## Repo map

| Path                                     | What                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/api`                               | AdonisJS 7 API (`@monkitrips/api`), Postgres 17, Lucid, Japa. Serves the SPA in production.           |
| `apps/web`                               | Angular 22 PWA (`@monkitrips/web`), zoneless, Tailwind 4, Transloco, Vitest.                          |
| `packages/shared`                        | `@monkitrips/shared`: wire types and pure domain helpers, compiled to `dist/`, tested with node:test. |
| `e2e`                                    | Playwright suite against the production builds (`@monkitrips/e2e`).                                   |
| `docker/`, `Dockerfile`, `compose*.yaml` | Production image, entrypoint, Postgres init, self-host / dev / E2E stacks.                            |
| `docs/`                                  | Architecture, contracts, runbook, self-hosting, decisions, backlog, lessons.                          |

## Non-negotiables

- **English** for code, comments, docs and commit messages. The UI is
  bilingual (en default, es) through catalogs with parity tests on both
  sides. Never hardcode user-facing copy. The web app follows the device
  language on first run and remembers the choice.
- **Public repo, no personal data.** Never write a real person's name,
  e-mail, city, booking code or the production domain anywhere (code, docs,
  fixtures, comments, commits). Use roles (owner, member, partner) and
  `example.com` / `localhost`. Seed values come only from `SEED_*` env vars.
- **TDD.** The test comes first and its name reads like a spec. Domain code
  is pure: no ORM, no framework, no implicit `now`. Laravel to Japa:

  | Laravel                     | Here                                                                                                                                   |
  | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
  | `RefreshDatabase`           | automatic in `functional`: migrate once per suite + global transaction per test (`tests/bootstrap.ts`); keep tests inside `test.group` |
  | `getJson()->assertStatus()` | `client.get(...)` then `response.assertStatus()` / `assertBodyContains()`                                                              |
  | `assertDatabaseHas`         | `db.assertHas('table', {...})`                                                                                                         |
  | `$this->swap()`             | `app.container.swap(Class, () => fake)` + `restore` (see `tests/functional/health.spec.ts`)                                            |
  | `actingAs`                  | `.loginAs(user)` once auth lands (WP 0.5)                                                                                              |

- **One concept per file**, named after the concept; never `utils.ts`.
- **Migrations are additive.** Two versions run side by side during a
  start-first update. Add columns and tables; drop only in a later release.
- **Stateless app.** No volume on the API container: cookie sessions, files
  in S3-compatible storage, logs to stdout.
- **Secrets only in env.** `apps/api/start/env_schema.ts` validates every
  variable at boot; secrets use `Env.schema.secret()`. Never type an env var
  as a list or an object. A new variable goes into `.env.example` too (a unit
  test fails otherwise).
- **No domains in source code**: `APP_URL` and docs with `example.com`.
- **Tenant isolation:** the trip is the boundary; a trip you are not a member
  of answers **404, never 403**.
- **Money is integer minor units** (`*Minor`) with ISO 4217 exponents from
  `@monkitrips/shared`; dates are `YYYY-MM-DD`.
- **Conventional Commits** (commitlint via lefthook; pre-push runs the privacy
  and commit-identity guards). release-please owns `CHANGELOG.md`: never edit
  it. Extra type: `security`. Linear history, rebase merges only.
- **No PR without `npm run verify` green.** Never skip, delete or loosen a
  test to get there.
- **Features never style:** only `mk-*` components, layout primitives and
  semantic tokens; a redesign touches tokens, `shared/ui` and assets only
  (`architecture.spec` enforces it).

## How to run

Node 24 (`nvm use`, exact version in `.nvmrc`), Docker.

```bash
npm ci                                     # exact lockfile install; also installs the git hooks (lefthook)
npm run services:up                        # Postgres 17 (compose.dev.yaml) on 127.0.0.1:5432
DB_PORT=5434 npm run services:up           # same, when 5432 is taken; export DB_PORT for tests too
cp apps/api/.env.example apps/api/.env && (cd apps/api && node ace generate:key)
(cd apps/api && node ace migration:run)
npm run dev                                # api :3333 + web :4200 (proxies /api)
npm test                                   # Japa + Vitest + shared node:test (network guard on)
npm run verify:quick                       # lint + typecheck + test + build
npm run verify                             # verify:quick + e2e (the PR gate)
npm run e2e                                # Playwright vs compose.test.yaml (slot 0: API 3334, Postgres 5433)
npm run e2e -- -- --project=mobile-chromium   # pass flags to Playwright after turbo's --
npm run build                              # production builds of every workspace
bash scripts/test-offline.sh               # the suite on a Docker network with no route out (Linux hosts only)
bash scripts/ci/privacy-check.sh           # privacy gate (PRIVACY_PATTERNS_FILE=docs/internal/privacy-patterns.txt locally)
npm run test:guards                        # self-tests of the CI guards and the network guard
npm run codegen                            # regenerate .adonisjs (Tuyau registry) after route changes
docker build --target runtime -t monkitrips:local .   # production image rehearsal
```

Each `npm run e2e` owns one slot (compose project, ports, result folders);
`scripts/e2e.sh` picks the first free one, or `E2E_SLOT=N` forces one.
`E2E_WEBKIT=1` adds the iPhone project; `CHROME_PATH` makes Chromium use a
system Chrome. Self-host smoke: see `docs/SELF_HOSTING.md`.

## Working mode: master agent + subagents

The master session decides, cuts work packages, writes briefs, integrates,
runs `npm run verify` and keeps `docs/QA.md`, `docs/BACKLOG.md` and
`docs/LESSONS.md`. Each subagent gets one self-contained package with: goal
and done criterion, files to read, the contract, the rules above, the
mandatory verification command and a report of at most 25 lines.
Subagents commit and stop; only the master opens and merges pull requests.

## Cloud sessions

This repo works the same from a laptop and from a Claude Code cloud session.
Details, environment variables and the first-session smoke: `docs/CLOUD.md`.

- A SessionStart hook (`scripts/cloud-setup.sh`, cloud only) puts Node from
  `/opt/node24` on PATH, pins the repo-scope git identity to the GitHub
  no-reply address from `gh api user`, installs dependencies the CI way when
  the lockfile changed, creates `apps/api/.env`, starts Postgres and prints
  status lines.
  Read them; a `WARN` line needs fixing first (`.claude/cloud-setup.log`).
- E2E uses Chrome for Testing from `CHROME_PATH`; never run
  `playwright install` in the VM. WebKit runs in CI only.
- Tests never reach the internet: `scripts/test/no-network.mjs` is loaded
  first by every runner, and `npm run test:offline` runs the suite on a
  Docker network with no route out.
- GitHub: `gh api` (REST) only; `gh pr`, `gh issue` and GraphQL answer 403.
  PRs are opened and merged by the master agent with the `ship` skill
  scripts (rebase merge).
- Limits: at most 2 implementer subagents, one full `npm run verify` at a
  time. An idle VM loses background processes; reread `docs/BACKLOG.md`,
  `git log` and the open PRs after a resume.
- Working mode and privacy rules: `.claude/rules/master-agent.md` and
  `.claude/rules/privacy.md`. Never print `$PRIVACY_PATTERNS`.

## Known traps (each one already cost time)

- **The Dockerfile's final stage must stay named `runtime`**: deployment
  tools always pass `--target`.
- **PWA files are never cached**: `index.html`, `ngsw-worker.js`, `ngsw.json`,
  `sw.js`, `manifest.webmanifest` and `/i18n/*` get `no-cache` +
  `CDN-Cache-Control: no-store` (`app/services/static_cache_policy.ts`).
  Hashed bundles are `immutable`; Angular 22 lazy chunks use mixed-case hashes.
- **Prod dependencies need `--omit=optional`**: playwright and typescript are
  optional peers of runtime packages and `--omit=dev` keeps them.
- **`.adonisjs/` is generated and committed.** Run `npm run codegen` after
  touching routes or controllers. `node ace build` / `node ace test` rewrite
  it, so the API `test` script runs `bin/test.ts` directly and turbo orders
  every reader after `api#codegen`.
- **`node ace codegen` boots the env**: a fresh clone needs `apps/api/.env`
  (copy `.env.example`, `node ace generate:key`) before `npm run verify`.
- **`Env.rules().validate()` prefers `process.env`**: unit tests use
  `validateEnv` from `start/env_schema.ts`, which checks only what it is given.
- **`ng test` runs with Vitest's `fsModuleCache` off** (`vitest-base.config.ts`):
  otherwise edits to what a spec imports run stale code.
- **Web specs preload every Transloco scope** (`src/testing/i18n-scopes.ts`);
  a new scope goes there or `i18n-testing.spec.ts` fails.
- **Tailwind 4 entry is plain CSS** (`src/styles.css`, the only file with hex
  colours besides the manifest). Prettier rewrites selector quotes there.
- **TypeScript stays on 6.0.x**: Angular 22.2 requires `>=6.0 <6.1` even though
  `npm view typescript` reports 7.
- **Lucid schema generation is off** until the first model exists: with no
  tables it writes a `database/schema.ts` that fails typecheck.
