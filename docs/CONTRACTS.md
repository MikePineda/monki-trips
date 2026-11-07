# Contracts

What other parts of the system (the web app, the image, operators) rely on.
Changing anything here is a breaking change unless stated otherwise.

## HTTP

Probes and the SPA fallback live outside `/api/v1`:

| Route                  | Name           | Answer                                                                                                                                                |
| ---------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`      | `health.ready` | 200 `{ status: 'ok', version, sha, checks: { db: { status } } }`; 503 with `status: 'error'` when the database ping fails. Statuses only, no details. |
| `GET /api/health/live` | `health.live`  | 200 `{ status: 'ok' }`. Touches no dependency.                                                                                                        |
| `GET /*` (not `/api`)  | `spa.fallback` | The SPA's `index.html` with `Cache-Control: no-cache`. Excluded from the Tuyau registry.                                                              |
| unknown `/api/**`      |                | 404 `{ message, code: 'E_ROUTE_NOT_FOUND' }`, never HTML.                                                                                             |

### API v1 (`/api/v1`)

Every success answers `{ data }` (lists that page add `metadata`). Access
levels: **public**; **session** (signed in; the session must carry the
account's current `sessionVersion` and the account must be active);
**verified** (session + verified e-mail); **member** (verified + live member
of `:tripId`, otherwise **404** `E_ROW_NOT_FOUND`, never 403); **owner**
(member with role `owner`, otherwise 403 `E_TRIP_ROLE`). `:tripId`, `:id` are
UUIDs (anything else is a route miss, 404 `E_ROUTE_NOT_FOUND`).

| Method and path                          | Name                           | Access   | Answer                                                                                                                                                                                                             |
| ---------------------------------------- | ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /config`                            | `config.show`                  | public   | `AppConfig`: `registrationOpen`, `locales`, `defaultLocale`, `version`. Also sets the `XSRF-TOKEN` cookie.                                                                                                         |
| `POST /auth/signup`                      | `auth.signup`                  | public   | 201 `UserProfile`, signed in. 403 `E_REGISTRATION_CLOSED` unless `invitationToken` is pending; 409 `E_EMAIL_TAKEN`.                                                                                                |
| `POST /auth/login`                       | `auth.login`                   | public   | 200 `UserProfile`. 401 `E_INVALID_CREDENTIALS`; 403 `E_ACCOUNT_DISABLED`; 429 after five failures (IP + e-mail) or ten (e-mail, any IP) in 15 min.                                                                 |
| `POST /auth/logout`                      | `auth.logout`                  | session  | 204. Ends this session only.                                                                                                                                                                                       |
| `POST /auth/logout-all`                  | `auth.logoutAll`               | session  | 204. Bumps `sessionVersion`: every other session is signed out, this one continues.                                                                                                                                |
| `GET /auth/me`                           | `auth.me`                      | session  | `UserProfile`.                                                                                                                                                                                                     |
| `POST /auth/email/verify`                | `auth.email.verify`            | public   | 204 with `{ token }` from the mail link. 410 `E_TOKEN_EXPIRED` when used, expired or unknown.                                                                                                                      |
| `POST /auth/email/verify-code`           | `auth.email.verifyCode`        | session  | 200 `UserProfile` with `{ code }` (6 digits). 400 `E_INVALID_CODE`; the 5th wrong code or 15 min → 410 `E_TOKEN_EXPIRED`.                                                                                          |
| `POST /auth/email/resend`                | `auth.email.resend`            | session  | 202 `{ data: { accepted: true } }`; a new link and code, the previous ones stop working. 409 `E_EMAIL_ALREADY_VERIFIED`.                                                                                           |
| `POST /auth/password/forgot`             | `auth.password.forgot`         | public   | 202 always, before any lookup. Mails a 60-minute single-use link to an existing active account.                                                                                                                    |
| `POST /auth/password/reset`              | `auth.password.reset`          | public   | 204 with `{ token, password }`. Signs out every session. 410 `E_TOKEN_EXPIRED`.                                                                                                                                    |
| `PATCH /me`                              | `me.update`                    | session  | `UserProfile`. Fields: `displayName`, `locale`, `timezone` (IANA), `theme`.                                                                                                                                        |
| `PUT /me/password`                       | `me.password`                  | session  | 204 with `{ currentPassword, password }`. Other sessions end. 403 `E_INVALID_PASSWORD`.                                                                                                                            |
| `GET /me/export`                         | `me.export`                    | session  | `AccountExport` (profile + one trip JSON v1 per live trip), `Content-Disposition: attachment`.                                                                                                                     |
| `POST /me/delete`                        | `me.delete`                    | session  | 204 with `{ password }`: hard delete in 30 days, signed out everywhere. 409 `E_SOLE_OWNER_OF_SHARED_TRIPS` + `tripIds`.                                                                                            |
| `POST /me/restore`                       | `me.restore`                   | session  | `UserProfile` with `deletionScheduledAt: null`. 409 `E_DELETION_NOT_SCHEDULED`.                                                                                                                                    |
| `POST /me/push-subscriptions`            | `me.pushSubscriptions.store`   | session  | 201 (new) or 200 (same endpoint again) `PushSubscription`. Body: `RegisterPushSubscriptionInput`.                                                                                                                  |
| `DELETE /me/push-subscriptions/:id`      | `me.pushSubscriptions.destroy` | session  | 204. Someone else's subscription: 404.                                                                                                                                                                             |
| `GET /invitations/:token`                | `invitations.show`             | public   | `TripInvitationPreview` (trip name, role, `requiresEmail`). 404 unknown; 410 `E_INVITATION_EXPIRED` otherwise.                                                                                                     |
| `POST /invitations/:token/accept`        | `invitations.accept`           | session  | 201 `Trip`; creates the membership and a traveller. 403 `E_INVITATION_EMAIL_MISMATCH` / `E_EMAIL_NOT_VERIFIED` (link only).                                                                                        |
| `GET /trips`                             | `trips.index`                  | verified | `TripListItem[]` (live trips, `role`, `memberCount`).                                                                                                                                                              |
| `POST /trips`                            | `trips.store`                  | verified | 201 `Trip`; owner membership + traveller. Client `id` makes it idempotent (200 on repeat; someone else's id → 404).                                                                                                |
| `GET /trips/:tripId/snapshot`            | `trips.snapshot`               | member   | `TripSnapshot`: `trip`, `members`, `travellers` (content entities join with their phase).                                                                                                                          |
| `DELETE /trips/:tripId`                  | `trips.destroy`                | owner    | 204. Soft delete; the trip disappears from every route except restore for 30 days (`purgeAfter`).                                                                                                                  |
| `POST /trips/:tripId/restore`            | `trips.restore`                | owner    | `Trip` with `deletedAt: null`.                                                                                                                                                                                     |
| `GET /trips/:tripId/members`             | `trips.members.index`          | member   | `TripMember[]`, owner first.                                                                                                                                                                                       |
| `PATCH /trips/:tripId/members/:id`       | `trips.members.update`         | owner    | `TripMember` with `{ role }`. The owner row and `role: 'owner'` answer 409 `E_OWNER_CANNOT_LEAVE` (use transfer-ownership).                                                                                        |
| `DELETE /trips/:tripId/members/:id`      | `trips.members.destroy`        | member   | 204. The owner removes anyone else; an editor removes only themselves (else 403). Owner leaving: 409 `E_OWNER_CANNOT_LEAVE`.                                                                                       |
| `POST /trips/:tripId/transfer-ownership` | `trips.transferOwnership`      | owner    | `TripMember[]` after the swap, with `{ userId }` of a live member (else 404 `E_NOT_A_MEMBER`).                                                                                                                     |
| `GET /trips/:tripId/invitations`         | `trips.invitations.index`      | owner    | `TripInvitation[]` with `state`; never the token.                                                                                                                                                                  |
| `POST /trips/:tripId/invitations`        | `trips.invitations.store`      | owner    | 201 `IssuedTripInvitation`. `{}`: `delivery: 'link'` with the plaintext `token` and `url` (shown once). `{ email }`: `delivery: 'email'`, mailed; the token never appears in the response (it proves the address). |
| `DELETE /trips/:tripId/invitations/:id`  | `trips.invitations.destroy`    | owner    | 204; the invitation answers 410 from then on.                                                                                                                                                                      |

Shapes live in `@monkitrips/shared` (`UserProfile`, `Trip`, `TripListItem`,
`TripMember`, `Traveller`, `TripInvitation`, `IssuedTripInvitation`,
`TripInvitationPreview`, `TripSnapshot`, `TripJsonV1`, `AccountExport`,
`PushSubscription`, `AppConfig`, `ApiEnvelope`, `ApiErrorBody`,
`ValidationErrorBody`, `ERROR_CODES`). Enums (`USER_STATUSES`, `USER_PLANS`,
`THEMES`, `BUDGET_MODES`, `TRIP_MEMBER_ROLES`, `USER_TOKEN_PURPOSES`) mirror
the database CHECK constraints; `tests/functional/schema.spec.ts` keeps them
in step.

### Errors

4xx answer `{ message, code }` with `message` from
`resources/lang/<locale>/errors.json` in the Accept-Language locale (fallback
`en`); `ERROR_CODES` in `@monkitrips/shared` maps every code to its status and
a unit test requires a message per code per locale. Some codes add fields
(`E_SOLE_OWNER_OF_SHARED_TRIPS` adds `tripIds`). Validation errors answer 422
`{ errors: [{ field, rule, message }] }` with messages from
`validator.json` (`shared.messages.<rule>`, `shared.fields.<field>`); dates
must be real calendar days (rule `calendarDate`, so `2026-02-30` is a 422).
Two requests that create the same row at once never answer 500: a taken
e-mail is 409 `E_EMAIL_TAKEN`, a repeated `POST /trips` id answers the
existing trip, any other duplicate key is 409 `E_CONFLICT`. 429
carries `Retry-After` and the `X-RateLimit-*` headers. Throttles key on the
socket address; `CF-Connecting-IP` counts only with `TRUSTED_PROXY=cloudflare`.
Login allows 5 failures per address from one IP and 10 per address from any
IP within 15 minutes. Production 5xx answer
`{ message, code: 'E_INTERNAL_SERVER_ERROR' }`.

### Sessions and CSRF

- Same-origin cookie session `monkitrips_session` (encrypted cookie store),
  `HttpOnly`, `SameSite=Lax`, 60 days, re-sent on every request (sliding
  expiry). No CORS.
- Every `POST`/`PUT`/`PATCH`/`DELETE` needs the `X-XSRF-TOKEN` header equal to
  the `XSRF-TOKEN` cookie, which any GET through the router sets
  (`GET /api/v1/config` is the natural first call). Missing or stale: 403
  `E_BAD_CSRF_TOKEN`.
- `users.session_version` is stored in the session at login and compared on
  every request. Sign out everywhere, password reset/change and
  `users:disable` bump it; stale sessions answer 401 `E_UNAUTHORIZED`.

### Links in mails (web app routes)

| Mail           | Link                             | Body                                  |
| -------------- | -------------------------------- | ------------------------------------- |
| Verification   | `APP_URL/verify-email?token=…`   | also a 6-digit code (15 min, 5 tries) |
| Password reset | `APP_URL/reset-password?token=…` | 60 min, single use                    |
| Invitation     | `APP_URL/invite/<token>`         | 7 days, single use                    |

Texts come from `resources/lang/<locale>/mails.json` in the recipient's
locale (the inviter's for invitations). `MAIL_DRIVER=log` logs the masked
recipient (`m***@example.com`) and the subject only.

## Typed client

Every route has a name; `npm run codegen` writes the Tuyau registry to
`apps/api/.adonisjs/client` (committed). The web imports it only from
`src/app/core/api/`. `apps/api/bruno/` holds one request per route;
`npm run bruno:coverage` fails when a route has none.

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
  overwrites client-sent values. Installed on `trips`, `trip_members`,
  `travellers` (migrations 4, 5, 7) with the sync columns `change_xid`,
  `change_seq`, `field_clock`, `deleted_at`, `updated_by` and the index
  `(trip_id, change_xid, change_seq)`.
- Enums are `text` + CHECK; partial unique indexes apply to live rows
  (`deleted_at IS NULL`): one owner per trip, one live membership and one
  live traveller per (trip, user).
- Tables of this package: `users`, `user_tokens`, `rate_limits`, `trips`,
  `trip_members`, `trip_invitations`, `travellers`, `push_subscriptions`,
  `llm_usage`, `sync_mutations`, `scheduler_runs`. Tokens are stored as
  sha256 hashes only.

## CLI

| Command                                                                      | Effect                                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `node ace users:disable <email>`                                             | `status = disabled` and every session revoked. `--enable` reverts.     |
| `node ace users:plan <email> <plan>`                                         | `plan` = `free` or `pro`.                                              |
| `node ace db:seed --files=./database/seeders/production_bootstrap_seeder.js` | Owner (+ partner) from `SEED_*`, verified, `pro`, no trip. Idempotent. |

## Container

- Final Dockerfile stage `runtime`; listens on `PORT` (3333) as user `node`.
- `HEALTHCHECK` calls `/api/health` with Node's `fetch`.
- `MIGRATE_ON_START=true` migrates with `--force` before serving; a failed
  migration exits non-zero. `SEED_USERS=true` runs the production bootstrap
  seeder (a no-op without `SEED_OWNER_EMAIL`/`SEED_OWNER_PASSWORD`).
- Build info: `.app-version` (root `package.json` version) and `.git-sha`.

## Web app

- Manifest: `name` "monki trips", `id` "/", `start_url` "/trips",
  `display` standalone, `orientation` portrait, colours = `--surface-0`.
- Service worker: no `dataGroups` for `/api`; `navigationUrls` exclude `/api/**`.
- Language: stored choice (`localStorage` `mt:lang`), else first supported
  device language (`es-*` -> es), else en. Theme: `localStorage` `mt:theme`
  (`light` | `dark`), else the device scheme.
- Routes the API links to: `/verify-email`, `/reset-password`, `/invite/:token`.
