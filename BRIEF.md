# monki-trips — product brief

A travel PWA for people travelling together: plan the trip, follow it on the road, keep the history.
Built for two people first and open to the public later without a rewrite.
License: AGPL-3.0-only. Repo: <https://github.com/MikePineda/monki-trips>. Implementation plan: [`docs/PLAN.md`](docs/PLAN.md).

## 1. Context and problem

The owner's framing, in order of weight:

1. **Follow the itinerary to the letter.** At any moment the app answers "what's next, when do we leave, where do we sleep tonight".
2. **Everything about the trip in one place, without internet.** Bookings, tickets, documents, tasks, money. Offline is not a mode; it is the default.

Today this lives in a hand-made planning page. Its structure is the starting point for the data model:

| Section of the hand-made page                                                          | Becomes                                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Pending items grouped by urgency, with estimated cost and link                         | Tasks with urgency buckets and optional cost     |
| Bookings with legs (code, when, detail) and "paid / total"                             | Events with segments, booking code, status, cost |
| Day by day: place, title, plan, movements, "where we sleep" with status                | Itinerary days and lodging events                |
| Nights table where overnight trains and the final flight count as a covered night      | Night coverage pipeline                          |
| Budget by category with status (paid / booked / estimated), subtotal, 10 % contingency | Budget categories and expenses                   |
| Notes; visa reminder as a callout                                                      | Notes, tasks, emergency info                     |

Facts from real use: several people hold different tickets and seats on the same leg. The exchange rate is fixed at booking time.

First real case: an 18-day multi-country trip with several time zones and currencies, starting late January 2027.

## 2. v1 objective

**Gate: on 15 January 2027 the app is loaded and usable offline for the first real trip.** The bar is measurable:

- [ ] The owner and the owner's partner sign in from their phones with the PWA installed.
- [ ] The real trip is loaded (trip JSON v1 import from the owner's laptop; never committed).
- [ ] "Ready to fly" is all green and "Tested offline" shows a date.
- [ ] Today, itinerary, where we sleep, documents (including the one that must be printed), tasks and expenses in foreign currency → base currency work without network and sync on reconnect.
- [ ] `npm run verify` is green.
- [ ] A backup exists and a restore was tested.

If something must be cut before the trip, cut AI, never offline.

## 3. Principles

| Principle                                    | What it means in practice                                                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Works offline for everything critical        | Trip data is read from the local database; the API only refills it. Critical writes (expenses, tasks, checklist, "save offline") queue in an outbox. |
| Logging an expense takes three taps or fewer | FAB → amount keypad already focused with sensible defaults → Save. Category chip is optional.                                                        |
| Most important first                         | Today shows the next thing, then documents, then tonight, then money. Nothing decorative on data.                                                    |
| Own personality                              | A mascot with states, passport stamps, a chosen visual direction. Not a booking site, not a generic AI-generated app.                                |
| No AI-provider lock-in                       | AI sits behind an adapter compatible with the Anthropic Messages API. No business logic tied to a provider.                                          |
| Multi-user from day one                      | Shared trips with roles, more than two people per trip, travellers without an account.                                                               |

## 4. MVP feature blocks

| Block               | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| History             | Trip list split into upcoming / ongoing / past (derived from dates, never stored). Summary with route chips (consecutive repeats collapse) and distinct country count. Deleted trips restorable for 30 days.                                                                                                                                                                                                                                                        |
| Itinerary           | Stops (place, country, time zone, arrive/depart). Events by kind (flight, train, ferry, bus, car, lodging, tour, meal, activity, free time, other) and status (idea, to book, booked, paid, cancelled). Times stored as local time + IANA zone; UTC is derived on the server. Multi-segment transport with per-person seats. A hotel is one lodging event (check-in → check-out). "Where we sleep" flags uncovered nights. "Directions" opens the platform map app. |
| Tasks               | Buckets: overdue, today, this week, later, no date. Priority low / normal / high. Pre-trip checklist from a template in code (i18n keys). A document tagged `print` creates a "Print {title}" task due the day before departure.                                                                                                                                                                                                                                    |
| Document vault      | Files (≤ 25 MB, magic-byte sniffed) or links, attached to the trip or an event. Tags: `print`, `show_on_phone`, `requires_passport`. Per-file "available offline" with hash check. Quick view without network (images, PDF). Downloads through short-lived signed URLs.                                                                                                                                                                                             |
| Budget and expenses | Money as integer minor units with per-currency exponent. Expense in any currency with the FX rate frozen at entry. Quick capture offline without a rate is allowed; the base amount is filled on sync. Categories with optional budgets. Remaining total and remaining today. Modes: **shared** (one pot) and **split** (who paid, shares per traveller). Split schema ships now; split UI and balances come in phase 4. Negative amount = refund.                  |
| Shared trips        | Roles `owner` (exactly one) and `editor`. Invitations by e-mail or single-use link, valid 7 days. Activity feed records field names only, never values. Removed members stop receiving the trip.                                                                                                                                                                                                                                                                    |

## 5. AI assistant (optional, phase 3)

Tools propose changes; the user confirms. Nothing is written until accepted.

| Tool                                                        | Kind       | Effect                                                                                       |
| ----------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| Read tools over the trip snapshot, budget, nights and Today | Read-only  | Answer questions with the same shared domain code the app uses. Exact names fixed in WP 3.1. |
| `propose_event_changes`                                     | Proposal   | Returns a diff of events; user accepts or rejects.                                           |
| `add_expense`                                               | Proposal   | Drafts an expense; user accepts or rejects.                                                  |
| `create_task`                                               | Proposal   | Drafts a task; user accepts or rejects.                                                      |
| `extract_booking`                                           | Proposal   | Reads a booking PDF or image and proposes events, segments and seats.                        |
| Phrase cards (phase 2.6)                                    | Generation | Local-language cards for the trip's countries.                                               |

Examples of requests:

- "What do we still need to print before we leave?"
- "Move tomorrow's tour to 9:00 and tell me when to leave the hotel."
- "We spent 450 on dinner, put it under food."
- "Here is the ferry booking PDF, add it to day 6."

Details:

- Streaming answers (SSE). The mascot shows `thinking` while the AI works.
- Proposals are stored as `ai_actions` with status `proposed → accepted | rejected | expired | failed`.
- Conversations are private to their creator; everything else in a trip is shared.
- Monthly token cap per user and plan; over the cap the API answers 402.
- Text from PDFs and web pages is passed as untrusted data inside `<data>`.
- First provider: MiniMax through the Anthropic-compatible adapter; an OpenAI-compatible slot exists. Tests use a fake provider with scripted tool calls.

## 6. Travel mode

**Today** (the sacred screen), top to bottom:

1. "Day N of M · {city}", connection status, small mascot.
2. Next event: title, local time, countdown, "Leave at 13:40", route chip, Directions.
3. Documents needed today with offline status; a `print` document shows a full-width "Bring this printed" banner.
4. Tonight: name, large copyable address, address in local script (for taxis), check-in, phone, Directions. No lodging = alert.
5. Left today: hero number in local currency, base currency below; includes expenses waiting to sync.
6. Weather (cached, with its age); hidden without data.
7. Quick-expense button above the tab bar.

**Offline-first:** trip data, documents saved offline, both languages, fonts and mascot are cached. "Ready to fly" checks all of it and offers "Download everything" and "Test in airplane mode".

**Extras**

| Extra                | Scope                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flight-change alerts | Behind a provider interface; `off` by default; phase 2.10 only if time allows.                                                                       |
| Local-language cards | Phrase cards per language, generated by the LLM behind its interface.                                                                                |
| Emergency info       | One structured document per trip (versioned schema), available offline.                                                                              |
| Push                 | Web push (VAPID): "leave at X", due tasks. iOS only when installed (≥ 16.4) and after a user gesture.                                                |
| Time zones           | Always the place's time, with zone abbreviation when it differs from the device. Days cut by local date. Departure and arrival keep their own zones. |

## 7. Identity and mascot

The first deliverable is a public `/styleguide` route (tokens, typography, components, mascot, stamps, both languages, light and dark) so the owner can review on a phone.

**Directions** (the owner picks one at design gate 1):

| Direction       | Palette (surface / ink / accent)                | Type                                                | Signature                                          |
| --------------- | ----------------------------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| A Notebook      | `#F2EDE3` / `#29241F` / `#22508F`               | Fraunces + Inter + IBM Plex Mono                    | Washi tape only on mascot, stamps and empty states |
| B Boarding pass | `#F5F5F2` / `#111417` / runway orange `#B5470C` | IBM Plex Sans + Mono for codes, times, booking refs | Ticket with perforation by SVG mask                |
| C Pixel         | `#FAFAF7` / `#16161A` / jungle green `#1E6B47`  | Atkinson Hyperlegible Next                          | Sprite mascot over the day strip                   |

Recommendation: B as structure, with A's stamps as reward. The owner decides.

**Mascot concepts** (original art only):

| Concept       | Idea                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Kiko          | Travelling monkey with a huge backpack and a passport sticking out; curious and scatterbrained; part of the "monki" family. |
| Golo and Lina | A pair of swallows that always return to the same nest.                                                                     |
| Tag and Tug   | Two luggage tags tied by the same string; grumpy when a document is missing.                                                |

**States** (priority order, computed by `mascot_state.ts`; `thinking` is set by the UI):

| State         | Trigger                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `celebrating` | Within 7 days after the trip ends                                                                                                |
| `asleep`      | Inside a transport that covers the night, or 22:00–06:00 local                                                                   |
| `worried`     | Spent > 90 % of a non-zero budget, an overdue `high` task, or a `print`/`show_on_phone` document for today not available offline |
| `excited`     | A flight or transport today, or departure day                                                                                    |
| `happy`       | Default                                                                                                                          |
| `thinking`    | While the AI is working                                                                                                          |

**Sprite contract (summary):** `public/mascot/<id>/sheet.{svg|png}` + `sheet.json` (version, 64×64 frames, `smooth` or `pixelated`, per-state frames, fps 1–12, loop, still frame) and a `LICENSE.md`; the active mascot is chosen in `public/mascot/active.json`. Sprites are replaceable without code changes. Passport stamps live in `public/stamps/` with a generated fallback.

## 8. Stack

| Layer          | Choice                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Runtime        | Node 24.22.2 (LTS), npm workspaces + Turborepo                                                                              |
| API            | AdonisJS 7, Lucid, VineJS, Tuyau, Japa                                                                                      |
| Database       | PostgreSQL 17                                                                                                               |
| Web            | Angular 22 (zoneless, signals, Signal Forms), Angular CDK, Tailwind 4, Transloco, Lucide icons                              |
| Offline        | Dexie 4 (IndexedDB), Angular service worker + a small custom SW for Share Target                                            |
| Files          | `@adonisjs/drive` on S3-compatible storage (MinIO in CI/E2E)                                                                |
| AI             | `@anthropic-ai/sdk` against an Anthropic-compatible endpoint (MiniMax first)                                                |
| FX / weather   | Frankfurter / Open-Meteo                                                                                                    |
| Mail / push    | Resend / `web-push` (VAPID)                                                                                                 |
| Maps (phase 4) | MapLibre GL                                                                                                                 |
| Tests          | Japa, Vitest, Playwright                                                                                                    |
| Deploy         | Docker image (ARM64 and x64); production host is a Docker Swarm deployment behind a CDN; self-host with `docker compose up` |

## 9. Open-source requirements

- AGPL-3.0-only, copyright "monki-trips contributors". `LICENSE`, `SECURITY.md`, private vulnerability reporting.
- Public from the first commit. No personal data anywhere: no names, e-mails, cities, booking codes or production domain. Roles in docs, `example.com` for hosts, synthetic fixtures only.
- Code, commits, docs, comments and PRs in English; UI in English and Spanish from day one.
- The full test suite runs with zero secrets: every external provider has a fake, and a network guard fails any test that reaches the internet.
- Self-hosting is documented in `docs/SELF_HOSTING.md` and needs only Docker.
- Forks do not receive repository secrets; generic CI checks still run for them.

## 10. Initial data model

All ids are UUID (UUIDv7 generated by the client). Money in integer minor units. Syncable tables carry the sync columns and soft delete.

| Entity                                                                        | Key fields                                                                                                                                                            |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                                                                       | email, display_name, locale, timezone, theme, email_verified_at, status (active, disabled), plan (free, pro)                                                          |
| `trips`                                                                       | name, base_currency, budget_mode (shared, split), budget_total_minor, starts_on, ends_on, home_tz                                                                     |
| `trip_members`                                                                | trip, user, role (owner, editor)                                                                                                                                      |
| `trip_invitations`                                                            | trip, email or link, token hash, role, expires_at, accepted/revoked                                                                                                   |
| `travellers`                                                                  | trip, display_name, user (nullable: person without an account)                                                                                                        |
| `stops`                                                                       | trip, position, name, country_code, lat/lng, tz, arrive_on, depart_on                                                                                                 |
| `events`                                                                      | trip, stop, kind, title, status, local start/end + zones + derived UTC, place, address, address_local, booking_code, cost, leave_buffer_min, travel_min, covers_night |
| `event_segments`                                                              | event, position, carrier, number, origin/destination, departs/arrives local + zone + UTC                                                                              |
| `segment_seats`                                                               | segment, traveller, seat, coach, ticket_number, document                                                                                                              |
| `documents`                                                                   | trip, event, kind (file, link), title, storage_key or url, mime, size, sha256, tags, available_offline                                                                |
| `tasks`                                                                       | trip, event, title, due_on, priority, done_at/by, origin (manual, template, document, ai)                                                                             |
| `budget_categories`                                                           | trip, key or name, budget_minor, position                                                                                                                             |
| `expenses`                                                                    | trip, category, event, amount_minor, currency, fx_rate, fx_rate_date, fx_source, base_amount_minor, spent_on, paid_by_traveller                                       |
| `expense_shares`                                                              | expense, traveller, share_minor (UI in phase 4)                                                                                                                       |
| `fx_rates`                                                                    | base, quote, rate_on, rate, source                                                                                                                                    |
| `emergency_info`, `phrase_cards`                                              | per trip; JSON content with schema version / per language                                                                                                             |
| `trip_activity`                                                               | actor, entity, action, field names (never values)                                                                                                                     |
| `push_subscriptions`, `ai_*`, `llm_usage`, `sync_mutations`, `scheduler_runs` | Supporting tables                                                                                                                                                     |

## 11. Phases and roadmap

| Phase                           | Until              | Content                                                                                                                   |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 0 Cloud-ready base and identity | 20 Nov 2026        | Scaffold, CI, public repo, cloud environment, production deploy, auth, design gates 1 and 2, `/styleguide`                |
| 1 Core                          | 11 Dec 2026        | Sync engine, shared domain, trips and itinerary, where we sleep, documents, tasks, members, import/export                 |
| 2 Money and travel mode         | 8 Jan 2027         | FX, budget and expenses, outbox, Today, "Ready to fly", emergency, phrase cards, push, Share Target, weather              |
| **Gate**                        | **15 Jan 2027**    | **Real trip imported in production; offline rehearsal on the phones**                                                     |
| 3 AI (optional)                 | 15 Jan → departure | Chat with streaming, proposal tools, booking extraction                                                                   |
| 4 After the trip                | —                  | Map and stamps, recap, split UI and balances, export to a finance app, `viewer` role, multi-arch image, open registration |

Cut order if time runs short: weather → Share Target → activity → AI.

## 12. Open decisions already resolved

| Decision            | Resolution                                                                             |
| ------------------- | -------------------------------------------------------------------------------------- |
| Name                | `monki-trips`, repo <https://github.com/MikePineda/monki-trips>                        |
| Platform            | PWA; Capacitor only if iOS limits get in the way                                       |
| Split budget        | Schema from the first migration; UI and balances in phase 4                            |
| Default UI language | English, following the device language when Spanish is preferred                       |
| Weather             | Open-Meteo (no key) `[verify]` terms                                                   |
| Map                 | MVP has only a "Directions" button; an in-app map is phase 4                           |
| License             | AGPL-3.0-only                                                                          |
| Registration        | Closed via `REGISTRATION_OPEN=false`; signup still works with a valid invitation token |

## Plan addendum (2026-11-07)

Decisions taken during planning (details in [`docs/PLAN.md`](docs/PLAN.md)):

1. Stack is AdonisJS **7** (the first draft said 6) + Angular 22 + Postgres 17 + Node 24.22.2.
2. The repo is public from the first commit so GitHub Actions (x64 and ARM runners, rulesets) are free. Only the owner creates the repo and pushes first.
3. The repo is cloud-ready: Claude Code cloud sessions can run the full suite (SessionStart hook, fakes, network guard, CI parity job).
4. Laptop does only the base scaffold and host operations; design, API, web and features run in cloud sessions.
5. Users and roles exist from day one, with the full auth cycle (verification, reset, invitations). No platform-admin role yet; operations go through CLI commands.
6. The trip is the tenancy boundary. A non-member gets 404, never 403.
7. All trip content is written through `POST /sync/push`, also online.
8. Work runs as a master agent with Opus subagents (one work package each); merges are autonomous when every gate is green.
9. `docs/LESSONS.md` records every friction; lessons are distilled at the end of each phase.
10. Two mandatory design gates: no product UI before the owner approves the direction and `/styleguide`.
11. The production domain and backup destination never enter the repo: code uses `APP_URL`, docs use `example.com`.
12. Real trip data never enters the repo or an agent's context; it is imported through the UI from the owner's laptop.
