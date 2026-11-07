# Architecture

monki trips is one deployable: an AdonisJS 7 API that also serves the
Angular 22 PWA, backed by Postgres 17. This page describes what exists today
(Phase 0 scaffold) and the shape the next packages fill in.

## Runtime

```
browser (installed PWA, service worker)
   │  same origin: /api/** -> API, everything else -> static files or index.html
   ▼
node (apps/api/build) ── Postgres 17
   └─ public/ = the Angular build (copied in by the Dockerfile and scripts/e2e.sh)
```

- **One image, one process.** `Dockerfile` builds shared -> web -> api, copies
  the web build into `apps/api/build/public` and runs `docker/entrypoint.mjs`
  (migrate when `MIGRATE_ON_START`, then the server in-process).
- **Stateless container.** Cookie sessions, files in S3-compatible storage
  (later; `DRIVE_DISK=fs` until then), logs to stdout, no volume.
- **Same origin, no CORS.** `ng serve` proxies `/api` to `:3333` in
  development (`apps/web/proxy.conf.json`).
- **Static files** go through `@adonisjs/static` with the cache policy in
  `app/services/static_cache_policy.ts`; every other GET outside `/api`
  falls back to `index.html` (`SpaController`).

## API (`apps/api`)

| Area       | Where                                             | Notes                                                                 |
| ---------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| Env        | `start/env_schema.ts`, `start/env.ts`             | Validated at boot; driver-dependent variables (S3, Resend, LLM).      |
| Routes     | `start/routes.ts`                                 | Named routes = the Tuyau contract; `.adonisjs/` is committed.         |
| Probes     | `app/controllers/health_checks_controller.ts`     | Readiness pings the DB (`DatabasePing`), liveness touches nothing.    |
| Build info | `app/services/build_info.ts`                      | `APP_VERSION`/`GIT_SHA`, else `.app-version`/`.git-sha` in the image. |
| i18n       | `config/i18n.ts`, `resources/lang/{en,es}`        | Locale from Accept-Language, fallback `APP_DEFAULT_LOCALE` (en).      |
| Errors     | `app/exceptions/handler.ts`                       | `{ message, code }`, message translated from `errors.<code>`.         |
| Sync       | `database/migrations/0000_sync_infrastructure.ts` | `sync_stamp()` trigger function + `sync_change_seq`.                  |
| Domain     | `app/domain/` (empty today)                       | Pure; ESLint forbids I/O imports there.                               |

Tests: `tests/unit` (no database) and `tests/functional` (migrated test
database, global transaction per test), run by `bin/test.ts`.

## Web (`apps/web/src/app`)

| Folder      | What                                                                    |
| ----------- | ----------------------------------------------------------------------- |
| `domain/`   | Pure TypeScript (no Angular, no RxJS); may import `@monkitrips/shared`. |
| `core/`     | App-wide services: `i18n/` (language pick, Transloco), `api/` (Tuyau).  |
| `layouts/`  | Frames. `shell/` owns the `shell` Transloco scope.                      |
| `features/` | Routed pages: `trips/` (empty state), `styleguide/` (tokens).           |

`architecture.spec.ts` enforces the layer rules, "no hex outside
`src/styles.css` and the manifest" and "no Google Fonts".

## Shared (`packages/shared`)

Wire types (health report, API prefix, locales) and pure domain helpers
(`domain/currency_exponent.ts`). Compiled to `dist/`; the API and the web
import the same code so offline calculations match the server.

## Sync model (contract for the next packages)

Syncable tables get `change_xid xid8`, `change_seq bigint`, `updated_at` and
a `BEFORE INSERT OR UPDATE` trigger with `sync_stamp()`. Pull pages by
`(change_xid, change_seq)` below the snapshot's xmin so concurrent
transactions are never skipped. Writes to trip content go through one push
endpoint with per-field last-write-wins.
