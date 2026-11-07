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
