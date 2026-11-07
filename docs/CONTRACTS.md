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

| Method and path                          | Name                           | Access   | Answer                                                                                                                                                                                                                                              |
| ---------------------------------------- | ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /config`                            | `config.show`                  | public   | `AppConfig`: `registrationOpen`, `locales`, `defaultLocale`, `version`, `pushEnabled`, `vapidPublicKey` (null while push is disabled). Also sets the `XSRF-TOKEN` cookie.                                                                           |
| `POST /auth/signup`                      | `auth.signup`                  | public   | 201 `UserProfile`, signed in. 403 `E_REGISTRATION_CLOSED` unless `invitationToken` is pending; 409 `E_EMAIL_TAKEN`.                                                                                                                                 |
| `POST /auth/login`                       | `auth.login`                   | public   | 200 `UserProfile`. 401 `E_INVALID_CREDENTIALS`; 403 `E_ACCOUNT_DISABLED`; 429 after five failures (IP + e-mail) or ten (e-mail, any IP) in 15 min.                                                                                                  |
| `POST /auth/logout`                      | `auth.logout`                  | session  | 204. Ends this session only.                                                                                                                                                                                                                        |
| `POST /auth/logout-all`                  | `auth.logoutAll`               | session  | 204. Bumps `sessionVersion`: every other session is signed out, this one continues.                                                                                                                                                                 |
| `GET /auth/me`                           | `auth.me`                      | session  | `UserProfile`.                                                                                                                                                                                                                                      |
| `POST /auth/email/verify`                | `auth.email.verify`            | public   | 204 with `{ token }` from the mail link. 410 `E_TOKEN_EXPIRED` when used, expired or unknown.                                                                                                                                                       |
| `POST /auth/email/verify-code`           | `auth.email.verifyCode`        | session  | 200 `UserProfile` with `{ code }` (6 digits). 400 `E_INVALID_CODE`; the 5th wrong code or 15 min → 410 `E_TOKEN_EXPIRED`.                                                                                                                           |
| `POST /auth/email/resend`                | `auth.email.resend`            | session  | 202 `{ data: { accepted: true } }`; a new link and code, the previous ones stop working. 409 `E_EMAIL_ALREADY_VERIFIED`.                                                                                                                            |
| `POST /auth/password/forgot`             | `auth.password.forgot`         | public   | 202 always, before any lookup. Mails a 60-minute single-use link to an existing active account.                                                                                                                                                     |
| `POST /auth/password/reset`              | `auth.password.reset`          | public   | 204 with `{ token, password }`. Signs out every session. 410 `E_TOKEN_EXPIRED`.                                                                                                                                                                     |
| `PATCH /me`                              | `me.update`                    | session  | `UserProfile`. Fields: `displayName`, `locale`, `timezone` (IANA), `theme`.                                                                                                                                                                         |
| `PUT /me/password`                       | `me.password`                  | session  | 204 with `{ currentPassword, password }`. Other sessions end. 403 `E_INVALID_PASSWORD`.                                                                                                                                                             |
| `GET /me/export`                         | `me.export`                    | session  | `AccountExport` as one JSON file (profile + one trip JSON v1 per live trip), `Content-Disposition: attachment`. The plan's zip is a backlog item.                                                                                                   |
| `POST /me/delete`                        | `me.delete`                    | session  | 204 with `{ password }`: hard delete in 30 days, signed out everywhere. 409 `E_SOLE_OWNER_OF_SHARED_TRIPS` + `tripIds`.                                                                                                                             |
| `POST /me/restore`                       | `me.restore`                   | session  | `UserProfile` with `deletionScheduledAt: null`. 409 `E_DELETION_NOT_SCHEDULED`.                                                                                                                                                                     |
| `POST /me/push-subscriptions`            | `me.pushSubscriptions.store`   | session  | 201 (new) or 200 (same endpoint again) `PushSubscription`. Body: `RegisterPushSubscriptionInput`.                                                                                                                                                   |
| `DELETE /me/push-subscriptions/:id`      | `me.pushSubscriptions.destroy` | session  | 204. Someone else's subscription: 404.                                                                                                                                                                                                              |
| `POST /me/push-subscriptions/test`       | `me.pushSubscriptions.test`    | session  | `PushTestResult` `{ sent, pruned, failed }`: the test message to every subscription of the caller, in their locale; endpoints the push service reports gone (404, 410) are deleted. 409 `E_PUSH_DISABLED` without VAPID keys.                       |
| `GET /invitations/:token`                | `invitations.show`             | public   | `TripInvitationPreview` (trip name, role, `requiresEmail`). 404 unknown; 410 `E_INVITATION_EXPIRED` otherwise.                                                                                                                                      |
| `POST /invitations/:token/accept`        | `invitations.accept`           | session  | 201 `Trip`; creates the membership and a traveller. 403 `E_INVITATION_EMAIL_MISMATCH` / `E_EMAIL_NOT_VERIFIED` (link only).                                                                                                                         |
| `GET /trips`                             | `trips.index`                  | verified | `TripListItem[]` (live trips, `role`, `memberCount`).                                                                                                                                                                                               |
| `POST /trips`                            | `trips.store`                  | verified | 201 `Trip`; owner membership + traveller. Client `id` makes it idempotent (200 on repeat; someone else's id → 404).                                                                                                                                 |
| `GET /trips/:tripId/snapshot`            | `trips.snapshot`               | member   | `TripContentSnapshot`: `trip`, `members`, `travellers` and every live content row (`stops`, `events`, `segments`, `seats`, `documents`, `tasks`, `budgetCategories`, `expenses`, `expenseShares`, `emergency`, `phraseCards`).                      |
| `GET /trips/:tripId/nights`              | `trips.nights`                 | member   | `TripNightsView`: one entry per night (`startsOn` to the day before `endsOn`) with what covers it; `uncoveredCount` is the "where do we sleep?" alert.                                                                                              |
| `GET /trips/:tripId/budget`              | `trips.budget`                 | member   | `TripBudgetView` in base minor units: spent, remaining, today's allowance and what is left of it, `pendingFxCount`, committed event costs, per category.                                                                                            |
| `GET /trips/:tripId/today?at=`           | `trips.today`                  | member   | `TripTodayView` for the instant `at` (ISO 8601, default now): the zone and date Today follows, the next event or segment with `leaveAt`, today's events and documents, where we sleep, `leftTodayMinor`, open tasks by urgency.                     |
| `POST /trips/:tripId/documents`          | `trips.documents.store`        | member   | 201 `TripDocument`. Multipart: `file` (≤ 25 MB, PDF or image decided from the bytes), `title`, `tags[]`, `eventId`, `availableOffline`, client `id` (200 on repeat). 413 `E_FILE_TOO_LARGE`, 415 `E_UNSUPPORTED_FILE`, 503 `E_STORAGE_UNAVAILABLE`. |
| `GET /trips/:tripId/documents/:id/file`  | `trips.documents.file`         | member   | 302 to a signed URL valid for 300 s (`Cache-Control: no-store`); images and PDFs open inline, anything else is `attachment`. A link document answers 404.                                                                                           |
| `GET /fx/rates?base=&symbols=&date=`     | `fx.rates`                     | verified | `FxRate[]`: units of each symbol per 1 `base` on `date` (default today), decimal strings, from the `fx_rates` cache or the provider; unknown symbols are left out. 503 `E_FX_UNAVAILABLE` when neither can answer.                                  |
| `GET /sync/pull?cursor=&limit=`          | `sync.pull`                    | verified | `SyncPullOutput` over every trip the account belongs to (see Sync). 410 `E_SYNC_CURSOR_EXPIRED` for a cursor older than 90 days or not one of ours.                                                                                                 |
| `POST /sync/push`                        | `sync.push`                    | verified | `SyncPushOutput`: one result per mutation (≤ 100), see Sync. The request itself fails (422) only when the envelope is malformed.                                                                                                                    |
| `DELETE /trips/:tripId`                  | `trips.destroy`                | owner    | 204. Soft delete; the trip disappears from every route except restore for 30 days (`purgeAfter`).                                                                                                                                                   |
| `POST /trips/:tripId/restore`            | `trips.restore`                | owner    | `Trip` with `deletedAt: null`.                                                                                                                                                                                                                      |
| `GET /trips/:tripId/members`             | `trips.members.index`          | member   | `TripMember[]`, owner first.                                                                                                                                                                                                                        |
| `PATCH /trips/:tripId/members/:id`       | `trips.members.update`         | owner    | `TripMember` with `{ role }`. The owner row and `role: 'owner'` answer 409 `E_OWNER_CANNOT_LEAVE` (use transfer-ownership).                                                                                                                         |
| `DELETE /trips/:tripId/members/:id`      | `trips.members.destroy`        | member   | 204. The owner removes anyone else; an editor removes only themselves (else 403). Owner leaving: 409 `E_OWNER_CANNOT_LEAVE`.                                                                                                                        |
| `POST /trips/:tripId/transfer-ownership` | `trips.transferOwnership`      | owner    | `TripMember[]` after the swap, with `{ userId }` of a live member (else 404 `E_NOT_A_MEMBER`).                                                                                                                                                      |
| `GET /trips/:tripId/invitations`         | `trips.invitations.index`      | owner    | `TripInvitation[]` with `state`; never the token.                                                                                                                                                                                                   |
| `POST /trips/:tripId/invitations`        | `trips.invitations.store`      | owner    | 201 `IssuedTripInvitation`. `{}`: `delivery: 'link'` with the plaintext `token` and `url` (shown once). `{ email }`: `delivery: 'email'`, mailed; the token never appears in the response (it proves the address).                                  |
| `DELETE /trips/:tripId/invitations/:id`  | `trips.invitations.destroy`    | owner    | 204; the invitation answers 410 from then on.                                                                                                                                                                                                       |

Shapes live in `@monkitrips/shared` (`UserProfile`, `Trip`, `TripListItem`,
`TripMember`, `Traveller`, `TripInvitation`, `IssuedTripInvitation`,
`TripInvitationPreview`, `TripSnapshot`, `TripContentSnapshot`, the stored
rows `TripStopRow`, `TripEventRow`, `EventSegmentRow`, `SegmentSeat`,
`TripDocumentRow`, `TripTaskRow`, `BudgetCategory`, `Expense`,
`ExpenseShare`, `FxRate`, `EmergencyInfo`, `PhraseCards`, the views
`TripNightsView`, `TripBudgetView`, `TripTodayView`, the `Sync*` types,
`TripJsonV1`, `AccountExport`, `PushSubscription`, `PushTestResult`,
`PushPayload`, `AppConfig`,
`ApiEnvelope`, `ApiErrorBody`, `ValidationErrorBody`, `ERROR_CODES`). Enums
(`USER_STATUSES`, `USER_PLANS`, `THEMES`, `BUDGET_MODES`, `TRIP_MEMBER_ROLES`,
`USER_TOKEN_PURPOSES`, `EVENT_KINDS`, `EVENT_STATUSES`, `DOCUMENT_KINDS`,
`DOCUMENT_TAGS`, `TASK_PRIORITIES`, `TASK_ORIGINS`, `FX_SOURCES`) mirror the
database CHECK constraints; `tests/functional/schema.spec.ts` keeps them in
step.

### Sync

All trip content is written through `POST /sync/push`, online too; the REST
routes above cover auth, trips, members, invitations, files and the computed
views. Both sync routes are per account, not per trip.

**Push** body: `{ mutations: [{ mutationId, tripId, entity, op, id, changes, changedAt }] }`,
at most 100. `mutationId`, `tripId` and `id` are client UUIDs (`id` is the
row; for `emergency` it equals `tripId`); `op` is `upsert` or `delete`;
`changes` carries only the fields that changed, in the entity's wire shape;
`changedAt` is when the person made the change (any ISO 8601 instant, UTC
when it has no offset), clamped on the server to `[now − 45 days, now]`; one
that is not an instant rejects that mutation (`E_VALIDATION_ERROR` on
`changedAt`), not the batch. Minor amounts are integers within
±`Number.MAX_SAFE_INTEGER` (also once converted to the base currency) and a
`fxRate` is greater than zero. Entities: `trip` (name, dates, budget, `homeTz`;
`baseCurrency` is owner-only and locked once expenses exist), `traveller`,
`stop`, `event`, `segment` (`position` is unique among an event's live
legs: moving a leg onto a taken position swaps the two, so a reorder sent
one leg at a time never conflicts), `seat`, `document` (metadata; files are created
by the upload route and a `file` cannot be created here), `task`,
`budget_category`, `expense` (an optional `shares` array replaces the whole
split and must sum to the amount; an `amountMinor` change without `shares`
must still match the live split), `expense_share`, `emergency` (one row per
trip, merged per top-level key of `content`). Derived values are never
accepted from a client and are recomputed after every merge: `startsAt`,
`startsOn`, `endsAt` from the local times and zones (a nonexistent local
time is a validation error, an ambiguous one is the earlier instant), an
event's start and end from its live segments, `baseAmountMinor` from the
stored rate (a missing rate is looked up for `spentOn`, in the cache then
the provider, and stays null while nobody can tell), `doneBy` from `doneAt`.
Parent ids (`eventId`, `segmentId`, `travellerId`, `documentId`,
`categoryId`, `paidByTravellerId`, `expenseId`) must name live rows of the
same trip; each `shares[].id` of an expense must be new or already a
share of that expense (an id of another expense or trip answers
`E_ROW_NOT_FOUND` and writes nothing); `eventId` of a segment, `segmentId` and `travellerId` of a seat,
`expenseId` of a share and `kind` of a document never change.

Each mutation runs in its own transaction and answers one of:

| status      | meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applied`   | every field won; `row` is the server's row.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `partial`   | at least one field lost against a newer stored change (`rejectedFields`); `row` shows what the server kept.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `duplicate` | this `mutationId` was applied before (same account); the stored result comes back. Rejections are not stored: a retry is re-evaluated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `rejected`  | nothing was written; `error: { code, message, errors? }`. `E_ROW_NOT_FOUND` (not a member, id of another trip, missing parent, unknown row), `E_ROW_DELETED` (tombstones always win; `row` is the tombstone), `E_TRIP_ROLE`, `E_BASE_CURRENCY_LOCKED`, `E_VALIDATION_ERROR` (with `errors`), `E_BAD_REQUEST` (an operation the entity does not allow), `E_CONFLICT` (a `mutationId` of another account, or a second live row where only one may exist: a seat per traveller and segment, a share per traveller and expense). A value the database cannot store is `E_VALIDATION_ERROR` too: one bad mutation never fails the batch. |

A field applies when its `changedAt` is not older than the field's clock
(`field_clock`); a tie goes to the last arrival. An expense's `shares` is
one field with its own clock entry: a stale split loses as a whole
(`partial`, `rejectedFields: ['shares']`). Deleting a row tombstones
it (`deletedAt`) and, for an event, its segments and seats; for a segment,
its seats; for an expense, its shares. A document tagged `print` gets one
"print this" task (`origin: document`, `titleKey: print_document`, due the
day before departure or today), removed with the tag unless done. Every
applied mutation leaves a `trip_activity` row with the field names only.

**Pull** `GET /sync/pull?cursor=&limit=` (limit ≤ 500, default 500) answers
`{ changes: [{ entity, row }], tripIds, cursor, hasMore }` over every trip
the account is a live member of. Entities are the push ones plus the
read-only `member` (with `displayName`) and `phrase_card`. Without a cursor
the answer is a snapshot of every live row; with one, every row changed
after it, tombstones included (`deletedAt` set), plus a snapshot of every
live row of each trip whose membership row for the account changed after
the cursor: a trip joined or re-joined, a role change, or a trip restored
(restore re-stamps its memberships). Those trips are new to the client,
whose cursor is past their old rows; their snapshot carries no tombstones
and may span pages (the cursor then records where it resumes). `tripIds` is
authoritative: the client drops any trip it holds that is not listed (a
removed member stops receiving the trip). The cursor is opaque; it encodes
the last change stamp delivered and its issue time, and one older than the
purge horizon (90 days) answers 410 `E_SYNC_CURSOR_EXPIRED`: the client
clears its cache, keeps its outbox and pulls again without a cursor. Pages
follow the global change order and never skip a row committed by a
transaction that was still open when an earlier page was read.

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

### Web push

- The server signs with VAPID (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`); without the three, `pushEnabled` is false, the test
  route answers 409 and the app shows no toggle. Changing the pair
  invalidates every subscription.
- Every message is the JSON `PushPayload` `{ title, body, url, tag }` in the
  recipient's locale (`resources/lang/<locale>/push.json`): `url` is a path
  on the app's origin the service worker opens on tap, `tag` replaces an
  earlier notification with the same tag (and travels as the push `Topic`).
  Messages live one day at the push service.
- A subscription is one browser (`endpoint` unique); registering it again
  from any account moves it to that account and resets `failures`. A
  delivery the push service refuses with 404 or 410 deletes the row; any
  other failure adds one to `failures`; a success stamps `last_used_at`.
- The browser subscribes with `vapidPublicKey` as `applicationServerKey`,
  only from a user gesture; on iOS only the installed app (16.4+) can.

### Scheduler

Every replica runs the in-process scheduler (`SCHEDULER=on`, the default)
and ticks once a minute. A job runs once per slot of its interval
(`minute`, `hour`, `day`, UTC) across all replicas: the slot is claimed in
one transaction with `pg_try_advisory_xact_lock(hashtext(job))` and an
insert into `scheduler_runs (job, run_key)` (unique), and the row ends as
`done` or `failed` with `finished_at`. Registered jobs: `push:prune`
(daily, a no-op until WP 2.7b). `SCHEDULER=off`, ace commands and the test
runner never tick.

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
- Tables: `users`, `user_tokens`, `rate_limits`, `trips`, `trip_members`,
  `trip_invitations`, `travellers`, `push_subscriptions`, `llm_usage`,
  `sync_mutations`, `scheduler_runs`, and the content tables of the sync
  package: `stops`, `events`, `event_segments`, `segment_seats`,
  `documents`, `tasks`, `budget_categories`, `expenses`, `expense_shares`
  (all S, with the stamp trigger and the cursor index), `fx_rates` (cache,
  keyed by base, quote and day), `emergency_info` (S, keyed by `trip_id`),
  `phrase_cards` (S), `trip_activity` (field names, never values). Tokens
  are stored as sha256 hashes only.
- Sync stamps are read as `(change_xid, change_seq)`: `pg` returns `xid8`
  as a decimal string and the row comparison `(change_xid, change_seq) > (?::xid8, ?::bigint)`
  pages the change order; pull delivers only rows with
  `change_xid < pg_snapshot_xmin(pg_current_snapshot())` (plus the calling
  transaction's own rows), so a transaction still in flight can never be
  skipped.
- Documents' bytes live in the drive disk under `trips/{tripId}/{documentId}`
  (`DRIVE_DISK=fs` under `apps/api/tmp/drive` for tests and development,
  `s3` otherwise); `sha256`, `mime` and `size_bytes` are stored with the row.
- Every trip starts with the six default budget categories (`key` =
  accommodation, transport, food, activities, shopping, other).

## CLI

| Command                                                                      | Effect                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node ace users:disable <email>`                                             | `status = disabled` and every session revoked. `--enable` reverts.                                                                                                                                                                                                                                     |
| `node ace users:plan <email> <plan>`                                         | `plan` = `free` or `pro`.                                                                                                                                                                                                                                                                              |
| `node ace db:seed --files=./database/seeders/production_bootstrap_seeder.js` | Owner (+ partner) from `SEED_*`, verified, `pro`, no trip. Idempotent.                                                                                                                                                                                                                                 |
| `node ace db:seed --files=./database/seeders/demo_trip_seeder.js`            | Development and E2E only: the accounts above plus the synthetic "Demo Loop" trip (18 days, base AUD, THB/JPY expenses, overnight train, last night on a plane, one uncovered night, a PDF tagged `print`, a two-segment flight with seats, overdue and high tasks). Idempotent by trip name and owner. |
| `node ace vapid:generate`                                                    | Prints a fresh VAPID pair as the three `VAPID_*` lines; stores nothing.                                                                                                                                                                                                                                |
| `node ace push:test --user <id or e-mail>`                                   | Sends the test notification to every device of the account.                                                                                                                                                                                                                                            |

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
  `sw.js` handles `push` (a `PushPayload` becomes a notification) and
  `notificationclick` (focuses an open window of the app, or opens one, on
  the payload's `url`) before importing Angular's worker.
- Notifications: the subscription id lives in Dexie `meta`
  (`push.subscriptionId`, `push.endpoint`) and goes with the account's data.
- Language: stored choice (`localStorage` `mt:lang`), else first supported
  device language (`es-*` -> es), else en. Theme: `localStorage` `mt:theme`
  (`light` | `dark`), else the device scheme.
- Routes the API links to: `/verify-email`, `/reset-password`, `/invite/:token`.
