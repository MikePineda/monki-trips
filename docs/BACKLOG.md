# Backlog

Dated one-liners. New ideas mid-session land here; the master triages them.

- 2026-11-07: Auth guard (`@adonisjs/auth` session guard) with the users table and `loginAs` in Japa (WP 0.5); only the cookie session store exists today.
- 2026-11-07: Enable Lucid schema generation (`config/database.ts`) together with the first model.
- 2026-11-07: Production bootstrap seeder behind `SEED_USERS` (docker/entrypoint.mjs has the TODO).
- 2026-11-07: `<meta name="theme-color">` per scheme: needs a decision on where its colour lives (the hex rule allows only styles.css and the manifest).
- 2026-11-07: Self-hosted fonts in `public/fonts/` with the service worker prefetch once the design direction is chosen.
- 2026-11-07: Real PWA icons and a `favicon.ico` from the mascot (today: generated placeholders).
- 2026-11-07: Drive config (`@adonisjs/drive`, fs/s3) and an S3 integration spec that runs only with `S3_ENDPOINT`.
- 2026-11-07: Nonce-based CSP, report-only first.
- 2026-11-07: Settings screen to change language and theme (LangStore.use and `mt:theme` already exist).
- 2026-11-07: Fresh clones need `apps/api/.env` before `npm run verify` (codegen boots the env); consider a `setup` script or generating it in the cloud hook.
- 2026-11-07: Foreign trip "not found" page: `tripMemberGuard` redirects to `/trips` today; the plan wants a not-found screen (never 403).
- 2026-11-07: "Pending" sheet for failed outbox entries (retry, edit, discard) and the `OutboxStore.failed` list in the shell (WP 2.3); the store, state machine and toast-on-conflict exist.
- 2026-11-07: Replace the fakes with the Tuyau client: `SESSION_API` (`/me`, trip membership) in 0.6b, `SYNC_API` (`/sync/pull|push`) in 1.1, `HEALTH_API` once the typed client is loaded at boot.
- 2026-11-07: Decide the initial bundle budget (414 kB with Dexie + CDK; warning at 350 kB, error at 450 kB).
- 2026-11-07: `/settings` is reachable outside a trip (header icon) besides `more/settings`; not in the plan's route list, confirm or drop.
- 2026-11-07: `/share` inbox reader over the service worker's `share-inbox` IndexedDB (WP 2.8); the SW half and the placeholder page exist.
- 2026-11-07: `ngsw-config.json` already prefetches `/fonts/**` and `/mascot/**` for WP 0.7; empty today.
- 2026-11-07: Update `docs/ARCHITECTURE.md` web table with `core/offline`, `core/session`, `core/theme`, `core/pwa`, `shared/ui` and `layouts/trip-shell` (left out of WP 0.6 by its scope rule).
- 2026-11-07: Purge job (scheduler): accounts past `deletion_scheduled_at`, trips past `purge_after`, `sync_mutations` older than 30 days, used `user_tokens`; trips owned solely by a deleted account are left untouched until then.
- 2026-11-07: "Recently deleted" trips list for restore (`GET /trips` hides soft-deleted trips; the web needs a way to reach `POST /trips/:tripId/restore`).
- 2026-11-07: Lucid schema generation stays off (`config/database.ts`) although models exist: enabling it writes a `database/schema.ts` to commit; decide with the sync WP.
- 2026-11-07: `E_BASE_CURRENCY_LOCKED` is reserved: trip edits (name, dates, `base_currency`) arrive with sync push; `viewer` role as an additive CHECK change.
- 2026-11-07: Bruno smoke in production needs a smoke user (`SMOKE_EMAIL`/`SMOKE_PASSWORD`, owner's machine) and `bru`; `ResendMailer` has no automated test (network) and should get one against a local fake endpoint.
- 2026-11-07: `docs/ARCHITECTURE.md` still says `app/domain/` is empty and lists no auth; refresh it after WP 0.5 lands.
- 2026-11-07: `GET /me/export` returns one JSON file (`AccountExport`) today; the plan asks for a zip with one trip JSON v1 per trip (and documents once they exist). Switch when documents land, keeping the JSON shape inside the zip.
