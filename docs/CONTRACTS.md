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

| Method and path                                     | Name                             | Access   | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------- | -------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /config`                                       | `config.show`                    | public   | `AppConfig`: `registrationOpen`, `locales`, `defaultLocale`, `version`, `pushEnabled`, `vapidPublicKey` (null while push is disabled). Also sets the `XSRF-TOKEN` cookie.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `POST /auth/signup`                                 | `auth.signup`                    | public   | 201 `UserProfile`, signed in. 403 `E_REGISTRATION_CLOSED` unless `invitationToken` is pending; 409 `E_EMAIL_TAKEN`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `POST /auth/login`                                  | `auth.login`                     | public   | 200 `UserProfile`. 401 `E_INVALID_CREDENTIALS`; 403 `E_ACCOUNT_DISABLED`; 429 after five failures (IP + e-mail) or ten (e-mail, any IP) in 15 min.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `POST /auth/logout`                                 | `auth.logout`                    | session  | 204. Ends this session only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `POST /auth/logout-all`                             | `auth.logoutAll`                 | session  | 204. Bumps `sessionVersion`: every other session is signed out, this one continues.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `GET /auth/me`                                      | `auth.me`                        | session  | `UserProfile` plus `llmTokensLeft` (LLM tokens left this UTC month).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `POST /auth/email/verify`                           | `auth.email.verify`              | public   | 204 with `{ token }` from the mail link. 410 `E_TOKEN_EXPIRED` when used, expired or unknown.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `POST /auth/email/verify-code`                      | `auth.email.verifyCode`          | session  | 200 `UserProfile` with `{ code }` (6 digits). 400 `E_INVALID_CODE`; the 5th wrong code or 15 min → 410 `E_TOKEN_EXPIRED`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `POST /auth/email/resend`                           | `auth.email.resend`              | session  | 202 `{ data: { accepted: true } }`; a new link and code, the previous ones stop working. 409 `E_EMAIL_ALREADY_VERIFIED`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `POST /auth/password/forgot`                        | `auth.password.forgot`           | public   | 202 always, before any lookup. Mails a 60-minute single-use link to an existing active account.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `POST /auth/password/reset`                         | `auth.password.reset`            | public   | 204 with `{ token, password }`. Signs out every session. 410 `E_TOKEN_EXPIRED`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `PATCH /me`                                         | `me.update`                      | session  | `UserProfile`. Fields: `displayName`, `locale`, `timezone` (IANA), `theme`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `PUT /me/password`                                  | `me.password`                    | session  | 204 with `{ currentPassword, password }`. Other sessions end. 403 `E_INVALID_PASSWORD`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `GET /me/export`                                    | `me.export`                      | session  | `AccountExport` as one JSON file (profile + one trip JSON v1 per live trip), `Content-Disposition: attachment`. The plan's zip is a backlog item.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `POST /me/delete`                                   | `me.delete`                      | session  | 204 with `{ password }`: hard delete in 30 days, signed out everywhere. 409 `E_SOLE_OWNER_OF_SHARED_TRIPS` + `tripIds`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `POST /me/restore`                                  | `me.restore`                     | session  | `UserProfile` with `deletionScheduledAt: null`. 409 `E_DELETION_NOT_SCHEDULED`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `POST /me/push-subscriptions`                       | `me.pushSubscriptions.store`     | session  | 201 (new) or 200 (same endpoint again) `PushSubscription`. Body: `RegisterPushSubscriptionInput`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `DELETE /me/push-subscriptions/:id`                 | `me.pushSubscriptions.destroy`   | session  | 204. Someone else's subscription: 404.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `POST /me/push-subscriptions/test`                  | `me.pushSubscriptions.test`      | session  | `PushTestResult` `{ sent, pruned, failed }`: the test message to every subscription of the caller, in their locale; endpoints the push service reports gone (404, 410) are deleted. 409 `E_PUSH_DISABLED` without VAPID keys.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `GET /me/notification-settings`                     | `me.notificationSettings.show`   | session  | `NotificationSettings` `{ leaveAt, checkOut, tasksDue, quietHoursStart, quietHoursEnd }`; an account that never saved any gets every reminder on and no quiet hours (`DEFAULT_REMINDER_SETTINGS`). Private to the account.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `PUT /me/notification-settings`                     | `me.notificationSettings.update` | session  | The saved `NotificationSettings` (upsert). Body: the same five fields, all required; quiet hours local `HH:MM` 00:00–23:59, both null or both set, else 422 (`quietHoursPair`, `regex`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `GET /me/reminders/upcoming`                        | `me.reminders.upcoming`          | session  | `UpcomingReminder[]` `{ kind, tripId, refId, fireAt, title, body, url }`: what `push:reminders` will send in the next 36 h, sorted by `fireAt`, rendered in the account locale, over the live trips the caller is a live member of, with the caller's settings. Works without a push subscription.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `GET /invitations/:token`                           | `invitations.show`               | public   | `TripInvitationPreview` (trip name, role, `requiresEmail`). 404 unknown; 410 `E_INVITATION_EXPIRED` otherwise.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `POST /invitations/:token/accept`                   | `invitations.accept`             | session  | 201 `Trip`; creates the membership and a traveller. 403 `E_INVITATION_EMAIL_MISMATCH` / `E_EMAIL_NOT_VERIFIED` (link only).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `GET /trips`                                        | `trips.index`                    | verified | `TripListItem[]` (live trips, `role`, `memberCount`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `POST /trips`                                       | `trips.store`                    | verified | 201 `Trip`; owner membership + traveller. Client `id` makes it idempotent (200 on repeat; someone else's id → 404).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `GET /trips/:tripId/snapshot`                       | `trips.snapshot`                 | member   | `TripContentSnapshot`: `trip`, `members`, `travellers` and every live content row (`stops`, `events`, `segments`, `seats`, `documents`, `tasks`, `budgetCategories`, `expenses`, `expenseShares`, `emergency`, `phraseCards`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `GET /trips/:tripId/nights`                         | `trips.nights`                   | member   | `TripNightsView`: one entry per night (`startsOn` to the day before `endsOn`) with what covers it; `uncoveredCount` is the "where do we sleep?" alert.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `GET /trips/:tripId/budget`                         | `trips.budget`                   | member   | `TripBudgetView` in base minor units: spent, remaining, today's allowance and what is left of it, `pendingFxCount`, committed event costs, per category.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `GET /trips/:tripId/balances`                       | `trips.balances`                 | member   | `TripBalancesView` in base minor units, from the shared `balances` function: `budgetMode`, one row per live traveller in position order (`travellerId`, `displayName`, `paidMinor`, `owedMinor`, `netMinor`; positive means the others owe them; people without an account included), then the fewest `settlements` `{ fromTravellerId, toTravellerId, amountMinor }` that settle the trip (greedy largest creditor and debtor, at most n − 1, ties in position order), `pendingFxCount` (left out while waiting for a rate) and `unassignedCount`. An expense without shares splits equally among every traveller; one without a payer counts as the owner's traveller. Each share converts as `trunc(base × share / amount)` and the rounding remainder goes to the payer. A shared-mode trip answers too.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `GET /trips/:tripId/today?at=`                      | `trips.today`                    | member   | `TripTodayView` for the instant `at` (ISO 8601, default now): the zone and date Today follows, the next event or segment with `leaveAt`, today's events and documents, where we sleep, `leftTodayMinor`, open tasks by urgency.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `GET /trips/:tripId/export`                         | `trips.export`                   | member   | The trip as one **trip JSON v1** document (see below), sent as the body itself (no `data` envelope, so the file re-imports as is) with `Content-Disposition: attachment; filename="trip-<slug>-<date>.json"` and `Cache-Control: no-store`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `POST /trips/import?dryRun=`                        | `trips.import`                   | verified | Body: a trip JSON v1 document, 2 MB at most (413 `E_FILE_TOO_LARGE`). `dryRun=true`: 200 `TripImportResult` with `tripId: null` and nothing written. Else 201 with the new `tripId`: always a **new** trip owned by the caller. 422 `{ errors }` writes nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `GET /schemas/trip-json-v1`                         | `schemas.tripJsonV1`             | public   | The JSON Schema (draft 2020-12) of trip JSON v1, `Cache-Control: public, max-age=3600`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `POST /trips/:tripId/documents`                     | `trips.documents.store`          | member   | 201 `TripDocument`. Multipart: `file` (≤ 25 MB, PDF or image decided from the bytes), `title`, `tags[]`, `eventId`, `availableOffline`, client `id` (200 on repeat). 413 `E_FILE_TOO_LARGE`, 415 `E_UNSUPPORTED_FILE`, 503 `E_STORAGE_UNAVAILABLE`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `GET /trips/:tripId/documents/:id/file`             | `trips.documents.file`           | member   | 302 to a signed URL valid for 300 s (`Cache-Control: no-store`); images and PDFs open inline, anything else is `attachment`. A link document answers 404.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `POST /trips/:tripId/documents/:id/extract`         | `trips.documents.extract`        | member   | 201 `AiAction` (tool `extract_booking`, `conversationId: null`, `proposal: AiBookingProposal`): the booking read from the document as a proposal; nothing is written until it is accepted. A document of another trip, a deleted one or an unknown id answers 404; a link 415. See Reading bookings and receipts below for the text and vision paths. 503 `E_EXTRACTION_UNAVAILABLE` (a scan or photo and no vision model), 413 `E_FILE_TOO_LARGE`, 402 `E_LLM_QUOTA_EXCEEDED`, 503 `E_LLM_UNAVAILABLE`, 422 `E_LLM_BAD_OUTPUT`, 429 (`throttleLlm`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `POST /trips/:tripId/receipts/extract`              | `trips.receipts.extract`         | member   | 200 `ReceiptDraft` (`amount`, `currency`, `spentOn`, `merchant`, `categoryKey`, `review`) from a multipart `file` (JPEG, PNG, WebP or GIF by its bytes, ≤ 5 MB). Never stored, no `ai_actions` row: the quick expense sheet shows it for confirmation and saves a normal expense through the outbox. 413, 415, 422 without a file, 503 `E_EXTRACTION_UNAVAILABLE`, 402, 429 (`throttleLlm`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `POST /trips/:tripId/tasks/from-template`           | `trips.tasks.fromTemplate`       | member   | `TemplateTasksResult` `{ tasks, created }`: creates the pre-trip checklist items the trip is missing (`origin: template`, `templateItemKey`, `titleKey: template.<key>`, `title` in the request locale, due relative to `startsOn`) and answers the whole live checklist in template order. Idempotent: a second call creates nothing (`created: 0`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `GET /trips/:tripId/weather?date=`                  | `trips.weather`                  | member   | `TripWeather` `{ date, place: { stopId, name }, current, daily, fetchedAt, attribution }` for that local date, or `null` when nothing is known (no placed stop or lodging that day, beyond the forecast, `WEATHER_PROVIDER=off`). The place is the stop covering the date (the one arrived at last on a travel day), else that night's lodging; `current` only on the place's today; `daily` is the date and up to two days after, conditions mapped to `clear, partly_cloudy, cloudy, fog, drizzle, rain, thunderstorm, snow`. Read from `weather_snapshots` (coordinates rounded to 2 decimals, shared, 30 min) or the provider; an outage answers the older snapshot with its own `fetchedAt`, else 503 `E_WEATHER_UNAVAILABLE`. 120 per hour per account.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `GET /trips/:tripId/emergency`                      | `trips.emergency.show`           | member   | `EmergencyInfo`, or `null` while nobody has written one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `PUT /trips/:tripId/emergency`                      | `trips.emergency.update`         | member   | `EmergencyInfo`. Body: the whole `EmergencyInfoContent`; a key left out becomes `null`. Goes through the `emergency` sync mutation with the request's clock (per-key last-write-wins, activity row), so an older offline edit of a key loses to it. 422 `{ errors }` writes nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `GET /fx/rates?base=&symbols=&date=`                | `fx.rates`                       | verified | `FxRate[]`: units of each symbol per 1 `base` on `date` (default today), decimal strings, from the `fx_rates` cache or the provider; unknown symbols are left out. 503 `E_FX_UNAVAILABLE` when neither can answer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `GET /sync/pull?cursor=&limit=`                     | `sync.pull`                      | verified | `SyncPullOutput` over every trip the account belongs to (see Sync). 410 `E_SYNC_CURSOR_EXPIRED` for a cursor older than 90 days or not one of ours.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `POST /sync/push`                                   | `sync.push`                      | verified | `SyncPushOutput`: one result per mutation (≤ 100), see Sync. The request itself fails (422) only when the envelope is malformed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `DELETE /trips/:tripId`                             | `trips.destroy`                  | owner    | 204. Soft delete; the trip disappears from every route except restore for 30 days (`purgeAfter`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `POST /trips/:tripId/restore`                       | `trips.restore`                  | owner    | `Trip` with `deletedAt: null`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `GET /trips/:tripId/phrase-cards`                   | `trips.phraseCards.index`        | member   | `PhraseCards[]`, the live set of each language, by language. Devices also get them through pull (`phrase_card`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `POST /trips/:tripId/phrase-cards`                  | `trips.phraseCards.store`        | member   | 201 `PhraseCards` with `{ language, preferences? }` (`GeneratePhraseCardsInput`; `language` is a BCP 47 tag of the shape `lang[-Script][-REGION]`, without variants, extensions or private-use subtags, stored canonical: `pt-br` → `pt-BR`, and one of `PHRASE_CARD_LANGUAGES` in `config/llm.ts`, else 422; the language reaches the model in the user turn inside `<data>`, never in the system prompt; at most 10 preferences of 80 characters). Generated once per trip and language through the LLM (see LLM below): greetings, a `reservation` card with the literal `{name}` placeholder (never a real name), one `lodging_address` card per live, non-cancelled lodging with an address, `food` from `preferences`, `emergency`, `numbers`. 409 `E_CONFLICT` with the existing `id` when the language exists, unless `?force=true` (the old set is tombstoned); 402 `E_LLM_QUOTA_EXCEEDED`; 503 `E_LLM_UNAVAILABLE`; 422 `E_LLM_BAD_OUTPUT`; 429 `E_TOO_MANY_REQUESTS` past 5 requests a minute or 30 a day per account (`throttleLlm`). Leaves `trip_activity` rows (`entity: phrase_card`). Card text never holds control characters (a line break aside) or bidi controls (U+202A–202E, U+2066–2069): an answer with one is refused like any invalid output. Clients render card text with text interpolation only, never as HTML. |
| `DELETE /trips/:tripId/phrase-cards/:language`      | `trips.phraseCards.destroy`      | member   | 204; tombstones that language's set so it can be generated again. 404 when there is none.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `GET /trips/:tripId/ai/conversations`               | `trips.ai.conversations.index`   | member   | `AiConversation[]`: the caller's own conversations in this trip, most recently used first. Conversations are private to their creator: another member's never appear.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `POST /trips/:tripId/ai/conversations`              | `trips.ai.conversations.store`   | member   | 201 `AiConversation` with `{ title? }` (at most 60 characters). Without a title the first message names it (its first line, first 60 characters, no model call).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `GET /trips/:tripId/ai/conversations/:id`           | `trips.ai.conversations.show`    | member   | `AiConversationDetail`: `messages` (display text of each turn, in order) and `actions` (every proposal with its diff and status). Proposals past their expiry read `expired`. 404 `E_ROW_NOT_FOUND` for anyone but the creator.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `DELETE /trips/:tripId/ai/conversations/:id`        | `trips.ai.conversations.destroy` | member   | 204; deletes the creator's conversation with its messages and proposals. What was accepted stays in the trip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `POST /trips/:tripId/ai/conversations/:id/messages` | `trips.ai.conversations.message` | member   | `{ text }` (1–4000 characters) → `text/event-stream` (see Assistant below). Creator only (else 404). `throttleLlm`; 402 `E_LLM_QUOTA_EXCEEDED` answers JSON with its status when the first model call cannot be reserved; any later failure is an `error` event.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `POST /trips/:tripId/ai/actions/:id/accept`         | `trips.ai.actions.accept`        | member   | The account that asked for the action only (else 404). `{ action, results }`: the stored mutations applied through `MutationApplier` in one transaction, `results` as `POST /sync/push` answers them. 409 `E_AI_ACTION_CLOSED` with `status` once decided or expired; 409 `E_AI_ACTION_STALE` when the trip changed since the proposal (the action becomes `failed`, nothing is written).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `POST /trips/:tripId/ai/actions/:id/reject`         | `trips.ai.actions.reject`        | member   | Creator only (else 404). `{ action }` marked `rejected`; nothing is written. 409 `E_AI_ACTION_CLOSED` with `status` once decided or expired.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `POST /trips/:tripId/ai/actions/:id/revise`         | `trips.ai.actions.revise`        | member   | `{ draft: BookingDraft }` replaces the draft of an `extract_booking` proposal: validated again (422 with `draft.<path>` fields and rules `timezone`, `regex`, `nonexistentLocalTime`, `afterOrEqual`, `amount`, `currency`, `range`), mutations, baseline and diff recomputed by the same dry run, flags of changed fields dropped. 200 `AiAction`. The account that asked for it only (else 404), `proposed` only (409 `E_AI_ACTION_CLOSED`); another tool answers 409 `E_AI_ACTION_NOT_REVISABLE`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `GET /trips/:tripId/members`                        | `trips.members.index`            | member   | `TripMember[]`, owner first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PATCH /trips/:tripId/members/:id`                  | `trips.members.update`           | owner    | `TripMember` with `{ role }`. The owner row and `role: 'owner'` answer 409 `E_OWNER_CANNOT_LEAVE` (use transfer-ownership).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `DELETE /trips/:tripId/members/:id`                 | `trips.members.destroy`          | member   | 204. The owner removes anyone else; an editor removes only themselves (else 403). Owner leaving: 409 `E_OWNER_CANNOT_LEAVE`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `POST /trips/:tripId/transfer-ownership`            | `trips.transferOwnership`        | owner    | `TripMember[]` after the swap, with `{ userId }` of a live member (else 404 `E_NOT_A_MEMBER`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `GET /trips/:tripId/invitations`                    | `trips.invitations.index`        | owner    | `TripInvitation[]` with `state`; never the token.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `POST /trips/:tripId/invitations`                   | `trips.invitations.store`        | owner    | 201 `IssuedTripInvitation`. `{}`: `delivery: 'link'` with the plaintext `token` and `url` (shown once). `{ email }`: `delivery: 'email'`, mailed; the token never appears in the response (it proves the address).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `DELETE /trips/:tripId/invitations/:id`             | `trips.invitations.destroy`      | owner    | 204; the invitation answers 410 from then on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

Shapes live in `@monkitrips/shared` (`UserProfile`, `Trip`, `TripListItem`,
`TripMember`, `Traveller`, `TripInvitation`, `IssuedTripInvitation`,
`TripInvitationPreview`, `TripSnapshot`, `TripContentSnapshot`, the stored
rows `TripStopRow`, `TripEventRow`, `EventSegmentRow`, `SegmentSeat`,
`TripDocumentRow`, `TripTaskRow`, `TemplateTasksResult`, `BudgetCategory`,
`Expense`, `ExpenseShare`, `FxRate`, `EmergencyInfo`, `EmergencyInfoContent`,
`PhraseCards`, `PhraseCard`, `GeneratePhraseCardsInput`, `PHRASE_CARD_CATEGORIES`, `LlmQuotaExceededPayload`, `LLM_PURPOSES`, `LLM_USAGE_STATUSES`, the pre-trip template (`PRE_TRIP_TEMPLATE`,
`PRE_TRIP_TEMPLATE_KEYS`, `missingTemplateTasks`, `templateTitleKey`), the views
`TripNightsView`, `TripBudgetView`, `TripTodayView`, the `Sync*` types,
`TripJsonV1` and its parts, `TripImportResult`, `TripImportSummary`,
`TripImportWarning`, `AccountExport`, `PushSubscription`, `PushTestResult`,
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
`baseCurrency` is owner-only and locked once expenses exist; `budgetMode`
is the budget's, so editors switch it too: turning it from `shared` to
`split` gives every live expense without a payer the owner's traveller
and every expense without a live split equal shares among all live
travellers, remainder on the payer, in the same transaction, with the
field clocks `paidByTravellerId` and `shares` at the mutation's
`changedAt` and one `trip_activity` row per expense; payers and splits
already recorded are kept, and switching back to `shared` writes nothing), `traveller`,
`stop`, `event`, `segment` (`position` is unique among an event's live
legs: moving a leg onto a taken position swaps the two, so a reorder sent
one leg at a time never conflicts), `seat`, `document` (metadata; files are created
by the upload route and a `file` cannot be created here), `task` (a client
creates `origin: manual` tasks, or `origin: template` ones with a
`templateItemKey` from the shared pre-trip template; `origin`, `templateItemKey`
and `titleKey` never change once the row exists, `document` and `ai` origins
are server-made, and an insert whose `templateItemKey` the trip already has
answers `duplicate` with the server's row instead of a second one),
`budget_category`, `expense` (`kind` is `expense` or `settlement`, set on insert
only: a later change is `E_VALIDATION_ERROR` `immutable`; budgets, Today and
the mascot leave settlements out, balances count them; an optional `shares` array replaces the whole
split and must sum to the amount; an `amountMinor` change without `shares`
splits the live split again equally between its participants still travelling,
remainder on the payer, with the mutation's clock on `shares`; on a trip in
split mode an expense written without a split, from a device that has not
pulled the switch, gets the switch's equal shares and the owner's traveller
as payer when it names none), `expense_share`, `emergency` (one row per
trip, merged per top-level key of `content`). Derived values are never
accepted from a client and are recomputed after every merge: `startsAt`,
`startsOn`, `endsAt` from the local times and zones (a nonexistent local
time is a validation error, an ambiguous one is the earlier instant), an
event's start and end from its live segments, `baseAmountMinor` from the
stored rate (a missing rate is looked up for `spentOn`, in the cache then
the provider, before the mutation's transaction locks anything, and stays
null while nobody can tell), `doneBy` from `doneAt`.
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
| `duplicate` | this `mutationId` was applied before (same account, still a member); the stored result comes back (after leaving the trip: `rejected E_ROW_NOT_FOUND`). Rejections are not stored: a retry is re-evaluated. Also an insert of a row the trip already has under another id (a task with a `templateItemKey` already present): nothing is written and `row` is the server's row, which the device adopts in place of its own.                                                                                                                                                                                                         |
| `rejected`  | nothing was written; `error: { code, message, errors? }`. `E_ROW_NOT_FOUND` (not a member, id of another trip, missing parent, unknown row), `E_ROW_DELETED` (tombstones always win; `row` is the tombstone), `E_TRIP_ROLE`, `E_BASE_CURRENCY_LOCKED`, `E_VALIDATION_ERROR` (with `errors`), `E_BAD_REQUEST` (an operation the entity does not allow), `E_CONFLICT` (a `mutationId` of another account, or a second live row where only one may exist: a seat per traveller and segment, a share per traveller and expense). A value the database cannot store is `E_VALIDATION_ERROR` too: one bad mutation never fails the batch. |

Every result of an `expense` mutation that names its row (`row`) also carries
`shares`: the expense's live split as the server keeps it after the mutation,
applied, partial or rejected. The client replaces its shares of that expense
with these unless a newer split of it is still queued.

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
read-only `member` (with `displayName`) and `phrase_card` (written only by
`POST /trips/:tripId/phrase-cards`). Without a cursor
the answer is a snapshot of every live row; with one, every row changed
after it, tombstones included (`deletedAt` set), plus a snapshot of every
live row of each trip whose membership row for the account changed after
the cursor: a trip joined or re-joined, a role change, or a trip restored
(restore re-stamps its memberships). Those trips are new to the client,
whose cursor is past their old rows; their snapshot carries no tombstones
and may span pages (the cursor then records where it resumes). `tripIds` is
authoritative: the client drops any trip it holds that is not listed (a
removed member stops receiving the trip). The cursor is opaque and signed
(HMAC-SHA256 with `APP_KEY`, so rotating the key expires every cursor); it
encodes the last change stamp delivered and its issue time, and one older
than the purge horizon (90 days), edited, or with a stamp beyond the bigint
range answers 410 `E_SYNC_CURSOR_EXPIRED`: the client
clears its cache, keeps its outbox and pulls again without a cursor. Pages
follow the global change order and never skip a row committed by a
transaction that was still open when an earlier page was read.

### Trip JSON v1

One trip as one JSON file, what `GET /trips/:tripId/export` writes, what
`POST /trips/import` and `node ace trip:import` read, and what each entry of
`GET /me/export`'s `trips` is. The format is published as a JSON Schema at
`GET /api/v1/schemas/trip-json-v1` (source:
`apps/api/resources/schemas/trip-json-v1.schema.json`); the TypeScript shape
is `TripJsonV1` in `@monkitrips/shared`.

- **Refs, not ids.** Every row that others point at carries a `ref` (a short
  string, unique within the file for its entity: `traveller-1`, `stop-2`,
  `event-3`, `segment-1`, `document-1`, `category-food`); events carry
  `stopRef`, segments nest inside their event and seats inside their
  segment (`travellerRef`, `documentRef`), expenses carry `eventRef`,
  `categoryRef`, `paidByTravellerRef` and `shares[].travellerRef` (and
  their `kind`: `settlement` round-trips, absent reads as `expense`), tasks
  `eventRef` and `sourceDocumentRef`, documents `eventRef`. Database ids and
  account ids never appear: `members` keeps role and display name only.
- **Times** are local wall clocks next to their IANA zone (`startsLocal` +
  `startTz`, `departsLocal` + `departsTz`...), never UTC alone; the instants
  are derived again on import. **Money** is integer minor units next to its
  ISO 4217 code (`amountMinor` + `currency`, `costMinor` + `costCurrency`);
  **rates** are decimal strings (`fxRate`, units of the expense currency per
  1 base unit) with `fxRateDate` and `fxSource`; `baseAmountMinor` is
  informational and recomputed from the rate.
- **Files.** A `file` document keeps its metadata (`storageKey`, `mime`,
  `sizeBytes`, `sha256`) and gets a `downloadUrl` signed for 300 s at
  export time; the bytes are not in the file. On import a file document
  becomes a `link` document to that `downloadUrl` (warning
  `fileDocumentAsLink`; one without a usable address is left out,
  `fileDocumentSkipped`). Importing the bytes (`?withFiles`) is a backlog item.
- **Import rules.** A document must pass the schema; then the trip fields,
  every row and every ref are checked (the same entity validators as
  `POST /sync/push`, so a daylight-saving gap or a split that does not add
  up is refused the same way) and the whole trip is rebuilt through the
  sync engine in one transaction: derived values, print tasks and
  `trip_activity` rows are the real ones. Any failure answers 422
  `{ errors: [{ field, rule, message }] }` with `field` as a path in the
  file (`events[2].stopRef`, rules `unresolvedRef`, `duplicateRef`, or the
  entity's own) and nothing is written. The caller becomes the owner; the
  file's first traveller is mapped to the caller's own traveller row
  (position applied, the caller's name kept: `callerIsFirstTraveller`);
  other members are not added (`membersNotImported`); default budget
  categories (by `key`) update the new trip's own rows, custom ones are
  created; tasks of origin `document` are recreated by their document's
  `print` tag and only their done state is replayed, other generated
  origins become manual tasks (`taskOriginReset`); phrase cards are left
  out (`phraseCardsSkipped`). Row ids and mutation ids are UUID v5 names
  derived from one fresh UUID per import, so a replay of the same request
  never collides with another import. Optional keys may be left out of a
  hand-written file: lists default to empty, positions to the row's index,
  `status` to `to_book`, `priority` to `normal`, `homeTz` to the caller's
  zone. Unknown keys are ignored.
- **Result.** `TripImportResult` `{ tripId, dryRun, summary }` with
  `summary: { trip: { name, startsOn, endsOn }, counts: { stops, events,
segments, seats, expenses, tasks, documents }, warnings: [{ code, message, count }] }`
  (messages in the request's locale, `resources/lang/<locale>/import.json`).

A minimal file:

```json
{
  "version": "trip-json-v1",
  "trip": {
    "name": "Weekend",
    "baseCurrency": "EUR",
    "startsOn": "2027-03-05",
    "endsOn": "2027-03-07",
    "homeTz": "Europe/Madrid"
  },
  "travellers": [
    { "ref": "traveller-1", "displayName": "Owner" },
    { "ref": "traveller-2", "displayName": "Kid" }
  ],
  "stops": [
    {
      "ref": "stop-1",
      "name": "Harbour Town",
      "countryCode": "AU",
      "tz": "Australia/Sydney",
      "arriveOn": "2027-03-05",
      "departOn": "2027-03-07"
    }
  ],
  "events": [
    {
      "ref": "event-1",
      "stopRef": "stop-1",
      "kind": "train",
      "title": "Night train",
      "status": "booked",
      "startsLocal": "2027-03-05T20:30",
      "startTz": "Australia/Sydney",
      "endsLocal": "2027-03-06T07:15",
      "endTz": "Australia/Sydney",
      "costMinor": 18000,
      "costCurrency": "EUR",
      "segments": [
        {
          "ref": "segment-1",
          "position": 1,
          "departsLocal": "2027-03-05T20:30",
          "departsTz": "Australia/Sydney",
          "arrivesLocal": "2027-03-06T07:15",
          "arrivesTz": "Australia/Sydney",
          "seats": [
            { "travellerRef": "traveller-1", "seat": "12A" },
            { "travellerRef": "traveller-2", "seat": "12B" }
          ]
        }
      ]
    }
  ],
  "expenses": [
    {
      "categoryRef": "category-food",
      "amountMinor": 4500,
      "currency": "AUD",
      "fxRate": "1.6",
      "spentOn": "2027-03-06",
      "paidByTravellerRef": "traveller-1",
      "shares": [
        { "travellerRef": "traveller-1", "shareMinor": 2250 },
        { "travellerRef": "traveller-2", "shareMinor": 2250 }
      ]
    }
  ],
  "documents": [
    {
      "ref": "document-1",
      "eventRef": "event-1",
      "kind": "link",
      "title": "Rail tickets",
      "url": "https://example.com/tickets/demo",
      "tags": ["print"]
    }
  ]
}
```

A full synthetic example is `apps/api/tests/fixtures/trip-json-v1/demo-loop.json`.

### LLM

Every model call goes through one interface (`app/services/llm/`):
`LlmProvider` (`complete` and `stream`), bound by `LLM_PROVIDER`:
`anthropic` is `AnthropicCompatibleProvider` (native `fetch` to
`${LLM_BASE_URL}/v1/messages` with `x-api-key` and `anthropic-version:
2023-06-01`; Anthropic itself or MiniMax's Anthropic-compatible endpoint;
`LLM_VISION_MODEL` for requests that carry an image or a PDF document block;
empty = vision off, `LlmProvider.supportsVision` is false and features that
need it answer 503 `E_EXTRACTION_UNAVAILABLE` without calling the model), `openai` is a seam that
answers 503 until written, `fake` answers from `tests/fixtures/llm/<purpose>/<case>.json`
(not in the image, so a deployment left on `fake` answers 503). Features call
`LlmClient`, never a provider.

- **Cap.** Tokens (input + output) per account and UTC month, from
  `config/plans.ts` (`free` 200 000, `pro` 3 000 000) or
  `LLM_MONTHLY_TOKEN_CAP_OVERRIDE` for every account. Before the provider is
  asked, the call reserves its estimated input (characters / 4, a flat 1 600
  per image) plus `maxTokens`: under a per-account advisory lock
  (`pg_advisory_xact_lock(hashtext('llm:' || user_id))`) it writes a
  `pending` `llm_usage` row, so parallel calls see each other's
  reservations. When spent tokens plus live reservations plus this one
  exceed the cap, the call is refused: 402 `E_LLM_QUOTA_EXCEEDED` with
  `{ used, cap, resetsOn }` (`used` counts live reservations; `resetsOn` =
  first day of the next UTC month). The row is settled with the real
  numbers when the call ends; a `pending` row older than 10 minutes
  (`LLM_PENDING_TTL_MS`, its process died) stops counting.
- **Throttle.** Every route that can call the model uses `throttleLlm`
  (`start/limiter.ts`): 5 requests a minute and 30 a day per account, else
  429 `E_TOO_MANY_REQUESTS`, on top of the monthly cap.
- **Usage.** Every call leaves one `llm_usage` row: user, trip, purpose
  (`chat`, `extract_booking`, `phrase_cards`), provider, model, tokens in/out,
  latency, status (`ok`, `error`, `quota_exceeded`, `pending` while in
  flight, `aborted` for a stream stopped early) and `cost_micros` from the
  price table in `config/llm.ts` (null for an unlisted model). Prompts and
  answers are never stored or logged. A stream the consumer stops early is
  `aborted` and charged the last usage the provider reported (the input from
  `message_start` at least), else the input estimate; the upstream body is
  cancelled.
- **Errors.** A 429, 5xx, network failure or timeout (90 s) is retried twice
  with backoff (0.5 s, 2 s); what still fails answers 503 `E_LLM_UNAVAILABLE`
  with no upstream detail. A stream that ends without `message_stop` is a cut
  connection, not an answer (503); a stream that fails midway (an `error`
  event) is charged the input reported at `message_start`. Any other failure
  the provider may have processed (a 2xx with a broken body, a timeout) is
  charged the input estimate; one it refused (an error status, a refused
  connection, not configured) is charged nothing.
- **The `<data>` rule.** Text that a person typed or a document contained
  (addresses, preferences, PDF or web text) reaches the model only inside
  `<data label="…">…</data>` in a user turn, never in the system prompt; the
  system prompt says such text is untrusted content, never instructions; it
  is NFKC-normalised, stripped of invisible format characters (`\p{Cf}`) and
  every `<` and `>` in it becomes `&lt;` / `&gt;`, so no tag can be formed
  inside it. Names never reach the model:
  cards use the `{name}` placeholder.
- **Structured output.** An answer meant as JSON is parsed (code fences and
  prose around it tolerated), validated with a VineJS schema and the
  feature's own checks; an invalid answer goes back once with the problems,
  a second one answers 422 `E_LLM_BAD_OUTPUT` and stores nothing. Both calls
  count.

### Assistant

A chat per trip (`app/services/assistant/`) that reads the trip and
proposes changes; nothing is written until the member accepts. Every model
call goes through `LlmClient` with purpose `chat` (cap reservation, usage
row, `throttleLlm` on the route).

- **Turn.** The system prompt is English, app-written and holds no trip
  content; it asks for answers in the member's locale (`users.locale`).
  The last 20 messages of the conversation go back as plain turns (no
  tool payloads), then the member's message as the user turn. The model
  may call **6 tools per turn**; after that one more call runs with
  `toolChoice: 'none'` and its answer ends the turn. A turn uses at most
  4 096 output tokens, 1 024 per call (`config/assistant.ts`).
- **Tools** (provider-neutral `LlmTool` with JSON Schema input). Read:
  `get_trip`, `list_events` (`from`/`to` local days), `get_budget_status`
  (shared `budget_status`), `list_documents` (titles and tags, never
  contents or links), `get_today` (shared `today_view`, optional `date`),
  `list_tasks` (urgency from the task rules). Write, which only record a
  proposal: `propose_event_changes` (add, move, edit, cancel; local times
  with IANA zones; a move keeps the duration unless the end is given),
  `add_expense` (`amount` as a decimal string in major units, ISO 4217
  `currency`, category key or name, `spentOn`), `create_task`.
  `extract_booking` (`documentId` from `list_documents`) runs the same
  `BookingExtraction` as the document route below, as its own metered call
  (purpose `extract_booking`); its proposal belongs to the turn, and a
  document of another trip is a tool error. There is no `search_web`. Every read is scoped to the route's trip; an id of another
  trip is a tool error. Booking codes are never sent to the model.
- **`<data>`.** Every tool result is JSON inside
  `<data label="<tool> result">`, escaped by `PromptBuilder.untrusted`, so
  event titles, notes, addresses and document titles reach the model only
  as untrusted content. Tool errors are app-written text that names fields
  and rules, never values. Results are bounded by size: free text per row
  is cut to 300 characters (notes) or 200 (addresses, place names), and a
  result past 16 000 characters (wrapper included) drops rows from its
  longest list and says `truncated: true` with a hint to narrow the
  request (for `list_events`, a date range).
- **Proposals.** A write tool runs its mutations through `MutationApplier`
  (`via: assistant`) in a transaction that is always rolled back: the
  proposal is validated by the code that will apply it, and its diff is
  read from the trip as it would be. The `ai_actions` row stores the
  `proposal` (the diff: `AiEventChangesProposal` with the changed fields
  per event and the nights whose cover changes before and after, from the
  shared night rules; `AiExpenseProposal` with the base-currency amount and
  rate of the spend day; `AiTaskProposal`), the exact `mutations` and the
  `baseline` (each touched row's `change_seq`, or null for a new row).
  The dry run locks the trip row first and reads the content the plan
  uses, the baseline and the outcome in that one state of the trip; a
  mutation that would not apply in full (`partial`, a field that loses the
  merge) is a tool error and nothing is proposed. Proposals expire 24 h
  after they were made.
- **Accept.** In one transaction, taking locks in the order every trip
  write uses (the trip row, then the action, then the content rows): the
  action must be `proposed` and not past `expires_at` (checked under the
  lock; one found expired is marked `expired` and answers 409
  `E_AI_ACTION_CLOSED`); every baseline row must still have its `change_seq` (a new
  row must still not exist); each mutation is applied with `changedAt` =
  now and must answer `applied`. Then the action is `accepted`, and
  `trip_activity` rows carry `actor_user_id` = the member and
  `via = 'assistant'` (`app` for every other write). A task created this
  way has origin `ai`. Any conflict rolls everything back, marks the
  action `failed` with `error_code = 'E_AI_ACTION_STALE'` and answers 409.
- **Stream.** `POST …/messages` answers `text/event-stream`; each event is
  `event: <type>` and `data: <JSON>` (`AssistantStreamEvent` in
  `@monkitrips/shared`):

  | `type`     | `data`                                       | When                                           |
  | ---------- | -------------------------------------------- | ---------------------------------------------- |
  | `text`     | `{ type, text }`                             | a delta of the answer, as the model writes it  |
  | `proposal` | `{ type, action: AiAction }`                 | a write tool recorded a proposal (id and diff) |
  | `done`     | `{ type, conversationId, messageId, title }` | the turn ended; the answer is stored           |
  | `error`    | `{ type, code, message }`                    | the turn failed after something was streamed   |

  The first model call is reserved before any header goes out: a turn
  refused there (402 `E_LLM_QUOTA_EXCEEDED`) stores nothing and answers
  JSON with its status. Then the headers go out at once
  (`Content-Type: text/event-stream`, `Cache-Control: no-cache`,
  `X-Accel-Buffering: no`), a `: ping` comment follows every 15 s while
  nothing else is written, and every later failure (the provider down on
  the first call included) arrives as an `error` event. A client that
  disconnects aborts the turn: the model stream in flight is cancelled and
  charged as `aborted`, no further model call is made, and what was
  streamed stays the stored answer along with its proposals. Prompts,
  answers and tool payloads are never logged.

### Reading bookings and receipts

`app/services/assistant/extraction/` (WP 3.3). A member asks the app to
read a document of the trip ("Read this booking") or a receipt photo
("Scan receipt"). Every call goes through `StructuredCompletion` (purpose
`extract_booking`: cap reservation, usage row, one retry on an invalid
answer, then 422 `E_LLM_BAD_OUTPUT`), with no tools offered.

- **Text first, vision second.** A PDF is read on the server with pdf.js
  (`unpdf`, pure JavaScript): the first 10 pages, cut to 20 000 characters,
  sent to the text model inside `<data label="booking document text">`.
  Only when that text layer has fewer than 120 letters and digits (a scan)
  does the PDF itself go to the vision model as an `LlmDocumentBlock`
  (≤ 10 pages, ≤ 5 MB, else 413 `E_FILE_TOO_LARGE`); an image (JPEG, PNG,
  WebP, GIF; ≤ 5 MB) goes as an `LlmImageBlock`. HEIC and links answer 415.
  Without `LLM_VISION_MODEL` a scan or a photo answers 503
  `E_EXTRACTION_UNAVAILABLE` before any model call. The file's bytes, its
  text, the prompt and the answer are never logged.
- **Draft.** The model answers a `BookingDraft` (`@monkitrips/shared`):
  `kind` (`flight`, `train`, `ferry`, `bus`, `lodging`, `tour`, `other`),
  title, provider, booking code, legs (origin and destination names and
  codes, local departure and arrival `YYYY-MM-DDTHH:mm` with IANA zones),
  start and end for a lodging or tour (check-in and check-out), place,
  address and address in the local script, `cost` as a decimal with its
  ISO 4217 `costCurrency`, seat lines without names, plus `needsReview`
  and `lowConfidence` (draft paths). Unknown is null; a zone is filled only
  when the file states it or names the airport, station or city, and is
  then listed in `needsReview`. An unknown zone, a nonexistent local time,
  an arrival before its departure or an amount the currency cannot hold is
  sent back once. Keys the schema does not name are dropped.
- **Review flags** (`ExtractionReviewFlag`): the app's own first
  (`missing` for a null title, leg time, start of a non-transport booking
  or a cost's currency; `needs_review` for a time without its zone), then
  the model's, kept only for paths the draft has.
- **Proposal.** The draft becomes sync mutations: one `booked` event
  (its own start and end unless it is transport), one segment per leg
  whose both ends are known with zones, the seat lines as the event's
  notes (a booking never says which traveller of the trip sits where), and
  the document's `eventId`. A time without its zone and an amount without
  its currency are left out, never guessed. They run through the chat's
  rolled-back dry run (`MutationDryRun`), and the `ai_actions` row
  (`tool = 'extract_booking'`, `conversation_id` null from the document
  route) stores `AiBookingProposal` (`documentId`, `eventId`, `source`
  `text` or `vision`, `draft`, `review`, `changes`: the added event and
  the nights whose cover changes), the mutations and the baseline. Accept
  and reject are the chat's; `revise` replaces the draft while `proposed`.
- **Receipt.** The same vision path returns a `ReceiptDraft` with `missing`
  flags for a null amount, currency or date; nothing is stored.

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

### Reminders

The pure planner `planReminders` (`@monkitrips/shared`, `reminder_plan.ts`)
yields, for one account, every reminder with `fireAt` in `[now, now + 36 h)`,
sorted by `fireAt`; the same input always gives the same
`(kind, refId, nominalFireAt)`. `nominalFireAt` is the fire time before
quiet hours (2026-11-08); `fireAt` is when it is sent.

| Kind        | Fires                                                                                                                                                                                   | `refId`                 | `url`                        | `params`                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------- | ------------------------------------------------- |
| `leave_at`  | flights, trains, ferries and buses (not cancelled, not ideas) at `leaveAtMs` (start − buffer − travel), read in the departure zone                                                      | event id                | `/t/:tripId/plan/e/:eventId` | `tripName`, `title`, `leaveTime`, `startTime`     |
| `check_out` | lodging with an end, an hour before the check-out; a check-out before 10:00 local fires at 08:00 local instead when that is before the check-out                                        | event id                | `/t/:tripId/today`           | `tripName`, `title`, `checkOutTime`               |
| `tasks_due` | once per trip and trip-local day (Today's zone rule: stop, else last started event, else home) at 09:00, up to the trip's end, when open tasks are due that day or `high` ones are late | `<tripId>:<YYYY-MM-DD>` | `/t/:tripId/more/tasks`      | `tripName`, `count`, `titles` (≤ 3, `, `), `more` |

- Times in `params` are local `HH:MM`. Keys are `reminders.<kind>.title` and
  `.body`; the API renders them from `push.json` (`push.reminders.*`, ICU).
- Quiet hours: a reminder whose local time (in its own zone) falls inside
  `[quietHoursStart, quietHoursEnd)` moves to the end (a window like
  22:00–07:00 ends the next morning); a move that would land at or after
  the departure, the check-out or the end of the digest's day keeps the
  original time. A disabled kind is never planned. Quiet hours whose start
  equals their end are rejected with 422 (`quietHoursDistinct`); both ends
  set or both null (`quietHoursPair`).
- The push message is the usual `PushPayload`: `title` and `body` rendered
  in the account locale, `url` as above, `tag` `<kind>:<refId>`.
- The `push:reminders` job (every minute) plans for each active account with
  at least one subscription and sends what fell due in `(now − 15 min, now]`
  (older ones are skipped). Each reminder is first inserted into
  `sent_reminders` with `ON CONFLICT DO NOTHING RETURNING id` and sent only
  when the insert returned a row, so it goes out once across replicas even
  beyond the slot claim. Without VAPID keys it does nothing.
- Dedupe (2026-11-08): the ledger key is `(user_id, kind, ref_id, fire_at)`
  with `fire_at` = `nominalFireAt`. Toggling quiet hours never re-sends nor
  drops a reminder already sent; an edited event time is a new occurrence
  and is sent again. `tasks_due` goes out at most once per user, trip and
  trip-local day: the insert is skipped when any row exists for
  `(user_id, 'tasks_due', ref_id)`, whatever its `fire_at` (the day's zone
  can move west during the day and with it the digest's 09:00).
- Delivery: at least once within the late window, at most once after a
  success. When a send reaches no subscription and at least one failure was
  transient (5xx, 429, timeout, network error), the ledger row is deleted
  and the next minute retries while the window lasts; 404/410 prune the
  endpoint as for the test push, any other 4xx is final.
- Cost: one run reads the candidate accounts, their settings, their live
  memberships of live trips (ended at most two days ago), and the stops,
  events and tasks of those trips in one query each (`whereIn`), whatever
  the number of accounts; each trip is built once for all its members and
  nothing else of a trip is read (`ReminderTripsLoader`).
  `GET /me/reminders/upcoming` plans through the same loader.

### Scheduler

Every replica runs the in-process scheduler (`SCHEDULER=on`, the default)
and ticks once a minute. A job runs once per slot of its interval
(`minute`, `hour`, `day`, UTC) across all replicas: the slot is claimed in
one transaction with `pg_try_advisory_xact_lock(hashtext(job))` and an
insert into `scheduler_runs (job, run_key)` (unique), and the row ends as
`done` or `failed` with `finished_at`. Registered jobs: `push:prune`
(daily, a no-op for now) and `push:reminders` (every minute, see
Reminders). `SCHEDULER=off`, ace commands and the test
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
  keyed by base, quote and day), `weather_snapshots` (cache shared by every
  account, keyed only by coordinates rounded to two decimals, 30 minutes), `emergency_info` (S, keyed by `trip_id`),
  `phrase_cards` (S), `trip_activity` (field names, never values;
  `via` is `app` or `assistant`), `ai_conversations` (`trip_id`,
  `user_id`: private to its creator, `title`), `ai_messages`
  (`conversation_id`, `role` user/assistant, display `content`, `seq`
  identity for order), `ai_actions` (`conversation_id`, `message_id`,
  `user_id`, `tool`, `status` proposed/accepted/rejected/expired/failed,
  `proposal`, `mutations`, `baseline` jsonb, `error_code`, `expires_at`,
  `decided_at`; index `(trip_id, status)`),
  `notification_settings` (one row per account that saved its reminder
  settings: `user_id` PK, `leave_at`, `check_out`, `tasks_due` booleans
  default true, `quiet_hours_start`/`quiet_hours_end` text `HH:MM`, both
  null or both set) and `sent_reminders` (`user_id`, `trip_id`, `kind`,
  `ref_id`, `fire_at`, `sent_at`; unique `(user_id, kind, ref_id, fire_at)`).
  Tokens are stored as sha256 hashes only.
- Sync stamps are read as `(change_xid, change_seq)`: `pg` returns `xid8`
  as a decimal string and the row comparison `(change_xid, change_seq) > (?::xid8, ?::bigint)`
  pages the change order; pull delivers only rows with
  `change_xid < pg_snapshot_xmin(pg_current_snapshot())` (plus the calling
  transaction's own rows), so a transaction still in flight can never be
  skipped.
- Wall clocks (`timestamp without time zone`, the `*_local` columns) are
  read as the text Postgres stores (a `pg` type parser in
  `config/database.ts`), never through the process zone, so `TZ` cannot
  move them.
- Documents' bytes live in the drive disk under `trips/{tripId}/{documentId}`
  (`DRIVE_DISK=fs` under `apps/api/tmp/drive` for tests and development,
  `s3` otherwise); `sha256`, `mime` and `size_bytes` are stored with the row. The signed
  download URL sets `Content-Disposition` with an ASCII `filename` and the
  full UTF-8 name in `filename*` (RFC 5987); the upload's temp file is
  deleted once the bytes are stored.
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
| `node ace trip:export <tripId> <file>`                                       | Writes a live trip as a trip JSON v1 file (download links of file documents valid for 300 s).                                                                                                                                                                                                          |
| `node ace llm:usage [--month YYYY-MM]`                                       | LLM calls, tokens, cap and cost per account for a UTC month (default: this one), biggest first; accounts by id and masked address (`t***@example.com`), never a full e-mail.                                                                                                                           |
| `node ace trip:import <file> --user <e-mail> [--dry-run]`                    | Loads a trip JSON v1 file (2 MB at most) as a new trip owned by that account, exactly like `POST /trips/import`; `--dry-run` only validates and prints the summary. Exit 1 with one line per problem when the file is refused.                                                                         |

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
