# Decisions and checks

Versioned decisions log (no personal data). Newest first within each date.

## Decisions

| Date       | Decision                                                                                                                                                                                                                                                                                    | Why                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-08 | Reminders dedupe on `UNIQUE (user_id, kind, ref_id, fire_at)` with `fire_at` = the planner's `nominalFireAt` (the fire time before quiet hours).                                                                                                                                            | Toggling quiet hours never re-sends nor drops a sent reminder; an edited event time is a new occurrence and is sent again (the person must learn the new time). |
| 2026-11-08 | `tasks_due` goes out at most once per user, trip and trip-local day: skipped when any `sent_reminders` row exists for `(user_id, 'tasks_due', ref_id)`, whatever its `fire_at`.                                                                                                             | The trip-local zone can move west during the day (a flight), which moves the digest's 09:00 to a later instant.                                                 |
| 2026-11-08 | Reminder delivery is at least once within the 15-minute late window and at most once after a success: a send that reached no device for a transient reason (5xx, 429, timeout, network) deletes its ledger row so the next minute retries; 404/410 prune the endpoint, other 4xx are final. | A push service blip must not lose a reminder; a success must never repeat.                                                                                      |
| 2026-11-08 | Quiet hours with the same start and end are rejected with 422 (`quietHoursDistinct`).                                                                                                                                                                                                       | An empty window is ambiguous (none or all day).                                                                                                                 |
| 2026-11-08 | `push:reminders` plans every candidate account in one batch: settings, memberships, stops, events and tasks in one query each (`whereIn`), each trip built once for all its members; never the full trip content. `GET /me/reminders/upcoming` uses the same loader.                        | The per-minute job's cost must not grow with the members of a trip.                                                                                             |
| 2026-11-07 | Default UI and error language is English; the web follows the device on first run (`es-*` -> es) and remembers the choice.                                                                                                                                                                  | Owner decision; supersedes Spanish as default.                                                                                                                  |
| 2026-11-07 | Driver credentials (`S3_*`, `RESEND_API_KEY`/`MAIL_FROM`, `LLM_API_KEY`/`LLM_MODEL`) may ship empty while the driver is off and become required when it is on.                                                                                                                              | Production starts with `DRIVE_DISK=fs` and fills storage in later.                                                                                              |
| 2026-11-07 | `compose.dev.yaml` host port comes from `DB_PORT` (default 5432).                                                                                                                                                                                                                           | Other local Postgres instances often hold 5432.                                                                                                                 |
| 2026-11-07 | `DB_PASSWORD` is a required secret.                                                                                                                                                                                                                                                         | Every supported Postgres setup (compose, self-host) has a password.                                                                                             |
| 2026-11-07 | Health check payload is `checks.db` only (no memory heap check).                                                                                                                                                                                                                            | Contract of the brief; heap pressure shows in container metrics.                                                                                                |
| 2026-11-07 | No `<meta name="theme-color">` in `index.html` yet.                                                                                                                                                                                                                                         | Hex colours live only in `styles.css` and the manifest.                                                                                                         |
| 2026-11-07 | Auth guard deferred to WP 0.5; the cookie session store is configured now.                                                                                                                                                                                                                  | A session guard needs the users table.                                                                                                                          |
| 2026-11-07 | Every external provider has a `fake` and tests use it (`apps/api/.env.test`, `e2e/e2e.env`).                                                                                                                                                                                                | The suite must never need the internet; the E2E fixture enforces it.                                                                                            |

## WebKit triage (QA-2)

The `e2e-webkit` journeys that failed on `main` (Playwright WebKit, project
`mobile-webkit`, iPhone 14 profile), classified from the CI logs and a
temporary capability probe on the CI runner, 2026-11-08.

| Journey                                                       | Classification                                                                             | Fix                                                                                                                                                                                                                                | Evidence                                                                                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J02 itinerary: stop, two events, day list, event detail       | Test bug                                                                                   | The journey expects Apple Maps directions on the iPhone project, Google Maps elsewhere (`domain/directions-link.ts` is right).                                                                                                     | `href` was `https://maps.apple.com/?daddr=14%20Quay%20Lane`, the test hardcoded Google Maps.                                                                                     |
| J04 documents: save a pdf offline, open it with no connection | Real app bug (Safari private browsing; any WebKit session that refuses Blobs in IndexedDB) | Offline copies store an `ArrayBuffer` (`bytes`) and are opened as a Blob of their type; older Blob copies are still read (`core/offline/doc-blob.ts`).                                                                             | Detail stayed "Not saved"; the caught error was `UnknownError: Error preparing Blob/File data to be stored in object store`; the probe stored an `ArrayBuffer` but not a `Blob`. |
| J07 cold offline boot: Today opens with no network            | Real app bug, same cause as J04                                                            | Same fix.                                                                                                                                                                                                                          | "Download everything" answered "2 documents could not be saved", so the journey never reached the offline boot (30 s timeout).                                                   |
| J07 cold offline boot keeps the weather                       | Real app bug, same cause as J04                                                            | Same fix.                                                                                                                                                                                                                          | Same outcome text as J07.                                                                                                                                                        |
| J10 ready to fly: red before download everything, green after | Playwright-WebKit limitation (no DevTools protocol, no installed app)                      | On WebKit the journey emulates the Home Screen app (`e2e/installed-iphone-app.ts`: `navigator.standalone`, persistent storage), the counterpart of the Chromium durable-storage grant, and expects "Running as the installed app". | `browser.newBrowserCDPSession: CDP session is only available in Chromium`; the probe saw `persist()` answer false and no `navigator.standalone`.                                 |
| J14 notifications: enable on the device, send a test          | Playwright-WebKit limitation                                                               | Only this test is skipped on WebKit; a new WebKit test checks that Safari asks to install the app first. Manual check N1 below.                                                                                                    | `Can't find variable: PushManager`; the probe saw no `PushManager` and no `Notification`; the section showed `ios-install`, which is correct in Safari.                          |

## iPhone manual checks

Run on a real iPhone (iOS 16.4 or later) against a staging or self-hosted
instance, after each release that touches offline, storage or push. Use a
synthetic trip only.

| Check                      | Steps                                                                                | Expected                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| I1 install the PWA         | In Safari: Share, Add to Home Screen, Add. Open it from the Home Screen and sign in. | Opens full screen; Ready to fly shows "Running as the installed app".                                                  |
| I2 ready to fly            | In the installed app: More, Offline, Download everything.                            | "Everything is on this phone"; every check green, storage persisted.                                                   |
| I3 airplane mode cold boot | After I2: force-quit the app, turn on airplane mode, open it from the Home Screen.   | Today shows the day, tonight's stay and the saved documents; a saved pdf opens in the quick view.                      |
| N1 notification test       | In the installed app: Settings, Notifications, enable, allow, Send a test.           | The test notification arrives on the lock screen; in Safari (not installed) the section asks to install the app first. |

## Cloud smoke

Filled by the first cloud session (WP 0.2). One row per check, no personal data.

| Check | Expected                                                   | Result | Evidence                                                                                                                                                                                                                                                                                             | Date       |
| ----- | ---------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| S1    | owner's handle; `proxy-injected`                           | PASS   | `gh api user` login equals the owner of the origin URL; `GH_TOKEN=proxy-injected`                                                                                                                                                                                                                    | 2026-11-07 |
| S2    | `.nvmrc` version, npm ≥ 11.19, `/opt/node24/bin`           | PASS   | node v24.20.0, npm 11.19.0, `/opt/node24/bin/node` first on PATH                                                                                                                                                                                                                                     | 2026-11-07 |
| S3    | hook output in context, log and stamp exist                | PASS   | hook ran by itself at startup, 6 `cloud-setup:` lines, no `WARN`; `.claude/cloud-setup.log` and `node_modules/.cloud-setup.sha256` exist; `npm ci` took 16 s                                                                                                                                         | 2026-11-07 |
| S4    | Docker answers; image present without a pull               | PASS   | dockerd running, Docker 29.9.2, Compose v5.6.1, overlayfs; `postgres:17` and `node:24.20.0-slim` already present                                                                                                                                                                                     | 2026-11-07 |
| S5    | accepting connections                                      | PASS   | `-p 127.0.0.1:55432:5432` → `pg_isready` accepting after ~1 s; container removed                                                                                                                                                                                                                     | 2026-11-07 |
| S6    | `--internal` network; suite green offline                  | PASS   | network create/rm ok; `test-offline.sh` green in 11 s (api 53, web 46)                                                                                                                                                                                                                               | 2026-11-07 |
| S7    | green; duration                                            | PASS   | 14/14 tasks; 9 s with 3 turbo cache hits, 14 s with `TURBO_FORCE=1`                                                                                                                                                                                                                                  | 2026-11-07 |
| S8    | green with Chrome for Testing, no download                 | PASS   | 3 passed, 2 workers, slot 0, 14 s; Chrome for Testing 153 from `CHROME_PATH`; no `~/.cache/ms-playwright`                                                                                                                                                                                            | 2026-11-07 |
| S9    | GitHub no-reply identity, no `Claude-Session`; check green | FAIL   | probe commit got the Anthropic agent no-reply identity from `/root/.gitconfig`, which overrides the setup script's `/etc/gitconfig` no-reply identity; no `Claude-Session` trailer; `check-commits.sh` green (it allows the Anthropic address); this session set repo-local `user.*` from `--system` | 2026-11-07 |
| S10   | context7 listed and answering                              | FAIL   | tools loaded; `resolve-library-id` for Angular: "Monthly quota exceeded. Create a free API key…"                                                                                                                                                                                                     | 2026-11-07 |
| S11   | `set`; personal-pattern count > 0                          | PASS   | `set`; `privacy-check.sh` and `privacy-pre-push.sh`: 1 personal pattern, 186 files clean                                                                                                                                                                                                             | 2026-11-07 |
| S12   | `pull_request` and `required_status_checks`                | PASS   | rules: deletion, non_fast_forward, required_linear_history, pull_request, required_status_checks; `gh pr list` 403 (GraphQL); `gh api …/pulls` works                                                                                                                                                 | 2026-11-07 |
| S13   | about 4 / 16 / 30                                          | PASS   | `nproc` 4; `free -g` 15 total; `df -h /` 252G size, 29G available (the per-session allowance)                                                                                                                                                                                                        | 2026-11-07 |
| S14   | `status` ok with version and sha                           | SKIP   | DNS not set yet: `$SMOKE_BASE_URL` host does not resolve in the VM and the proxy answers CONNECT 502                                                                                                                                                                                                 | 2026-11-07 |

VM facts (first session, 2026-11-07): `nproc` 4; `free -g` 15 GB total,
0 swap; `df -h /` 252G size, 11G used, 29G available; node v24.20.0, npm
11.19.0, `command -v node` → `/opt/node24/bin/node`; Docker 29.9.2 (client
and server), Compose v5.6.1; Chrome for Testing 153 at
`/usr/bin/google-chrome`; `CHROME_PATH`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
and `E2E_WORKERS=2` exported by the hook.

SessionStart hook output received as context:

```
node v24.20.0, npm 11.19.0
chrome: /usr/bin/google-chrome
deps: installed
.env: created
db: docker postgres:17 on 127.0.0.1:5432
privacy: patterns set (pre-push runs the full check)
```

## Accessibility audit (2026-11-08)

QA-1. `e2e/tests/a11y.spec.ts` (`mobile-chromium`, 390 × 844) visits every
screen of a synthetic trip signed in as its owner (trips, Today, summary,
Plan days, an event sheet, Where we sleep, Docs, the document quick view,
Money, the quick expense sheet, More, Tasks, Checklist, Members, Activity,
Emergency, Ready to fly, Phrases, trip and account Settings, the
styleguide) and, signed out, the login page and an invitation preview.

| Check                                           | Rule                                                                                                                                                                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| axe-core 4.14.0 (`@axe-core/playwright` 4.14.0) | tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`; light and dark; motion emulated as reduced so sheets are measured at rest                                                                                                |
| Tap targets                                     | 44 × 44 CSS px hit area for every control (DESIGN.md), stricter than WCAG 2.5.8's 24 px; a smaller visual passes when the points 21 px from its centre still hit it; links inside running text are exempt (2.5.8 "inline") |
| Focus                                           | Tab through each screen: every focused control draws an outline of at least 2 px or a box shadow                                                                                                                           |
| Outline                                         | one `main` landmark; one `h1` (an open sheet instead carries an accessible name and an `h2`); no skipped heading level                                                                                                     |
| Sheets                                          | Tab stays inside an open sheet; Escape gives the focus back to the opener (quick expense, event detail)                                                                                                                    |
| Language                                        | `<html lang>` follows English and Spanish, after a reload too                                                                                                                                                              |
| Overflow                                        | nothing runs past the right edge at 360 px                                                                                                                                                                                 |

Found on `main` and fixed in the ui-kit, the layouts and two feature
templates: 9 axe nodes in light (3 `color-contrast` on the print banner's
action, 6 `aria-required-children` from the segmented control's role on its
host) and 6 in dark, 96 controls below 44 px, 1 control without a focus
ring (date inputs), 25 outline problems (no `main` outside sign-in, an
`h1` → `h3` jump on Today, unnamed route sheets, the styleguide's mock
screens adding `h1`s) and the quick expense losing the focus on close.

**Exceptions: none.** The spec keeps an `EXCEPTIONS` list (rule, screen,
target, date, reason); it is empty.

Lighthouse 13.5.0, mobile preset (simulated slow 4G and CPU throttling),
Chrome from `CHROME_PATH`, local production build (`E2E_LIGHTHOUSE=1
npm run e2e -- -- --project=mobile-chromium lighthouse`). Lighthouse 12
dropped the PWA category: installability is Chrome's own
`Page.getInstallabilityErrors`. Accessibility and best practices are gated at
95; performance is reported, not gated.

| Page                                   | Performance | Accessibility | Best practices | Installable |
| -------------------------------------- | ----------- | ------------- | -------------- | ----------- |
| login, before → after                  | 70 → 69     | 100 → 100     | 96 → 96        | yes         |
| styleguide, before → after             | 52 → 51     | 90 → 100      | 96 → 96        | yes         |
| Today signed in, before → after        | 66 → 64     | 92 → 100      | 100 → 100      | yes         |
| production login page (public, `main`) | 91          | 100           | 96             | yes         |
| production styleguide (public, `main`) | 75          | 90            | 96             | yes         |

Both columns come from one run each, back to back; scores move by up to ±10 between runs on the shared VM (an earlier `main` run gave the styleguide 62 and Today 71, with 97 accessibility and 96 best practices on Today). The styleguide's 0.22 layout shift on its tokens section is on `main` too. What keeps it
down is outside this package and is in `docs/BACKLOG.md`: lazy chunks
whose hash holds `_` or `-` and the fonts get a one-hour cache instead of
`immutable`; signed-out pages log 401s from `/auth/me` and `/sync/pull`
(the only best-practices miss); `theme-boot.js` blocks render by design
(no theme flash).
