# Contracts

What other parts of the system (the web app, the image, operators) rely on.
Changing anything here is a breaking change unless stated otherwise.

## HTTP

| Route                  | Name           | Answer                                                                                                                                                |
| ---------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`      | `health.ready` | 200 `{ status: 'ok', version, sha, checks: { db: { status } } }`; 503 with `status: 'error'` when the database ping fails. Statuses only, no details. |
| `GET /api/health/live` | `health.live`  | 200 `{ status: 'ok' }`. Touches no dependency.                                                                                                        |
| `GET /*` (not `/api`)  | `spa.fallback` | The SPA's `index.html` with `Cache-Control: no-cache`. Excluded from the Tuyau registry.                                                              |
| unknown `/api/**`      |                | 404 `{ message, code: 'E_ROUTE_NOT_FOUND' }`, never HTML.                                                                                             |

Shapes live in `@monkitrips/shared` (`HealthReport`, `LivenessReport`).

Errors: 4xx answer `{ message, code }` with `message` from
`resources/lang/<locale>/errors.json` in the Accept-Language locale (fallback
`en`). Validation errors (when they exist) answer 422
`{ errors: [{ field, rule, message }] }`. Production 5xx answer
`{ message, code: 'E_INTERNAL_SERVER_ERROR' }`.

## Typed client

Every route has a name; `npm run codegen` writes the Tuyau registry to
`apps/api/.adonisjs/client` (committed). The web imports it only from
`src/app/core/api/`.

## Static caching

| Files                                                                                                                              | Cache-Control                              |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `index.html`, `ngsw-worker.js`, `ngsw.json`, `sw.js`, `manifest.webmanifest`, `safety-worker.js`, `worker-basic.min.js`, `/i18n/*` | `no-cache` + `CDN-Cache-Control: no-store` |
| content-hashed bundles (`name-HASH.ext`)                                                                                           | `public, max-age=31536000, immutable`      |
| anything else in `public/`                                                                                                         | `public, max-age=3600`                     |

## Database

- `sync_change_seq`: global sequence for sync ordering.
- `sync_stamp()`: trigger function that sets `change_xid = pg_current_xact_id()`,
  `change_seq = nextval('sync_change_seq')`, `updated_at = now()`; it always
  overwrites client-sent values.

## Container

- Final Dockerfile stage `runtime`; listens on `PORT` (3333) as user `node`.
- `HEALTHCHECK` calls `/api/health` with Node's `fetch`.
- `MIGRATE_ON_START=true` migrates with `--force` before serving; a failed
  migration exits non-zero. `SEED_USERS` is reserved (no-op until WP 0.5).
- Build info: `.app-version` (root `package.json` version) and `.git-sha`.

## Web app

- Manifest: `name` "monki trips", `id` "/", `start_url` "/trips",
  `display` standalone, `orientation` portrait, colours = `--surface-0`.
- Service worker: no `dataGroups` for `/api`; `navigationUrls` exclude `/api/**`.
- Language: stored choice (`localStorage` `mt:lang`), else first supported
  device language (`es-*` -> es), else en. Theme: `localStorage` `mt:theme`
  (`light` | `dark`), else the device scheme.
