# Lessons

Dated one-liners: what did not work as written, where (laptop/cloud/CI), what
changed. The master distils the general ones into the project playbook.

- 2026-11-07 (laptop): the plan pins Node 24.22.2 but nvm on the laptop has 24.20.0; `.nvmrc` and the Docker base image use 24.20.0 (`node:24.20.0-slim`); bump both together.
- 2026-11-07 (laptop): `npm view typescript` reports 7.0.2, but Angular 22.2 compiler-cli and build require `>=6.0 <6.1`; every workspace pins `~6.0.3`.
- 2026-11-07 (laptop): `@types/node` latest is 26.x; pinned `~24.19.2` to match the Node 24 runtime, and Dependabot ignores its majors.
- 2026-11-07 (laptop): host port 5432 was taken by another project's Postgres; `compose.dev.yaml` takes the host port from `DB_PORT` (default 5432) and the suite ran with `DB_PORT=5434` (process env wins over `.env.test`).
- 2026-11-07 (laptop): `Env.rules().validate()` reads `process.env` before the given values, so a test cannot prove a missing variable fails; `start/env_schema.ts` exports `validateEnv`, which applies the same rules to only the given values.
- 2026-11-07 (laptop): validator-lite treats an empty string as "not set" for optional rules, so empty `S3_*` values already pass; requiring them with `DRIVE_DISK=s3` needed an explicit cross-variable check.
- 2026-11-07 (laptop): Angular 22 lazy chunks use mixed-case hashes (`chunk-D436evU6.js`); the reference uppercase-only regex gave them a 1 h cache instead of `immutable`. The regex now accepts mixed case but needs an uppercase letter or a digit.
- 2026-11-07 (laptop): Lucid 22 schema generation (on by default in development) wrote `database/schema.ts` with only an unused import when there are no tables, failing `tsc`; disabled until the first model.
- 2026-11-07 (laptop): `node ace codegen` boots the env, so it fails without `apps/api/.env` (`APP_KEY`); a fresh clone must create it first (CI and the cloud hook too).
- 2026-11-07 (laptop): Playwright 1.65 needs chromium headless shell v1254, not installed by `npm install`; ran `npx playwright install chromium`.
- 2026-11-07 (laptop): `@angular/pwa` is an `ng add` schematic, not a runtime dependency; the manifest, `ngsw-config.json` and `provideServiceWorker` were written by hand with `@angular/service-worker`.
- 2026-11-07 (laptop): the session guard of `@adonisjs/auth` needs a user model, which does not exist before WP 0.5; only `@adonisjs/session` with the cookie store is installed now.
- 2026-11-07 (laptop): Prettier with the AdonisJS config rewrites `[data-theme="dark"]` to single quotes in CSS; a spec that matched the double-quoted selector broke after `--write`. Run the specs after formatting.
