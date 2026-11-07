---
name: monki-trips
colors:
  background: '#f5f5f2'
  on-background: '#111417'
  surface: '#f5f5f2'
  surface-dim: '#e3e3df'
  surface-bright: '#fbfbf9'
  surface-container-lowest: '#fbfbf9'
  surface-container-low: '#f0f0ec'
  surface-container: '#ecece8'
  surface-container-high: '#e6e6e2'
  surface-container-highest: '#e0e0db'
  surface-variant: '#ecece8'
  on-surface: '#111417'
  on-surface-variant: '#4a5058'
  inverse-surface: '#2a2e33'
  inverse-on-surface: '#f0f0ec'
  outline: '#80868e'
  outline-variant: '#d7d8d3'
  surface-tint: '#b5470c'
  primary: '#b5470c'
  on-primary: '#f5f5f2'
  primary-container: '#f9ebe1'
  on-primary-container: '#7a2e06'
  inverse-primary: '#f08a4b'
  secondary: '#4a5058'
  on-secondary: '#f5f5f2'
  secondary-container: '#ecece8'
  on-secondary-container: '#111417'
  tertiary: '#2f5c8a'
  on-tertiary: '#f5f5f2'
  tertiary-container: '#e3eaf2'
  on-tertiary-container: '#1e3d5c'
  error: '#a01c1c'
  on-error: '#f5f5f2'
  error-container: '#f6e0de'
  on-error-container: '#6e1212'
  accent: '#b5470c'
  accent-ink: '#f5f5f2'
  accent-soft: '#f9ebe1'
  focus: '#b5470c'
  line: '#d7d8d3'
  line-strong: '#80868e'
  print-warning: '#f4e2ae'
  on-print-warning: '#111417'
  on-print-warning-2: '#4a5058'
  offline: '#4a5058'
  stamp-ink: '#2f5c8a'
  status-good: '#2e6b3f'
  status-warning: '#845600'
  status-serious: '#7e3418'
  status-critical: '#a01c1c'
  mark-neutral: '#5d646b'
  mark-muted: '#c3c8cd'
  gridline: '#e3e4df'
  baseline: '#a4acb4'
  series-1: '#2a78d6'
  series-2: '#1baf7a'
  series-3: '#eda100'
  series-4: '#9b3f8f'
  series-5: '#008300'
  series-6: '#e87ba4'
  series-7: '#6250d6'
  series-8: '#e34948'
typography:
  display:
    fontFamily: IBM Plex Sans
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.4px
  title:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.12px
  heading:
    fontFamily: IBM Plex Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0px
  body:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0px
  body-strong:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0px
  label:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.13px
  caption:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.12px
  code-display:
    fontFamily: IBM Plex Mono
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: 0.48px
  code:
    fontFamily: IBM Plex Mono
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0px
  code-label:
    fontFamily: IBM Plex Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.52px
  eyebrow:
    fontFamily: IBM Plex Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.96px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.5rem
  lg: 0.75rem
  xl: 1rem
  full: 9999px
spacing:
  base: 8px
  half: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  gutter: 16px
  row: 56px
  tap-target: 44px
  primary-target: 48px
  tab-bar: 56px
  safe-top: 47px
  safe-bottom: 34px
  container-max: 480px
---

## Brand & Style

monki-trips is an offline-first travel app for people travelling together: the itinerary, where you sleep, documents, tasks and the shared budget, usable without a connection. It should feel like a trusted travel companion that is calm under pressure: you are in a station with a dead SIM and a train in 20 minutes, and the screen tells you exactly what to do. It is not a booking site and must never look like a generic AI-generated app.

The style is **Boarding pass** (round 1, direction B): the calm of a departures board. Cool off-white or near-black surfaces, ink type, codes and times set in mono so they line up like a ticket, and a single runway-orange accent that only ever means "you can tap this". The next event is a ticket card with a perforation. Two pieces of character, both kept away from data: **Kiko**, a travelling monkey with a huge backpack (the mascot), and **passport stamps** from direction A as the reward on the trip list.

Principles, in priority order:

1. **The next thing first.** Today leads with what happens next and when to leave. Everything else supports it.
2. **One accent, for interaction.** Runway orange marks what can be tapped or is selected: the primary button, the FAB, links, the active tab, the selected segment or chip, the focus ring. Never a fill on data, never a chart mark, never a status.
3. **Hairlines, not boxes.** Content is separated by 1px hairlines and whitespace. The ticket is the only card on a screen; there are no cards inside cards.
4. **Codes read like a ticket.** IATA codes, times, countdowns and booking references are mono with tabular figures, so they line up and can be read aloud at a counter.
5. **Honest offline.** Being offline is normal: the app says "Offline · everything saved", shows how old cached data is, and never pretends. Empty states say what is missing and offer one action.

**Voice.** Bilingual from day one: en-AU (default) and es-MX, same structure, separate catalogues. Sentence case everywhere, including buttons ("Save expense", "Guardar gasto"). Short declarative sentences; no exclamation marks, no emoji, no jokes about money or about anyone. People are "you" and "{partner}" ("tú" y "{pareja}"); the UI never assumes a name. Times are the place's local time, with the zone abbreviation when it differs from the device ("14:20 EEST"). Dates are day-first ("Wed 12 May", "mié 12 may"). Money shows the local currency as the hero and the base currency below it ("€84" over "A$138"); negatives use the true minus sign U+2212 ("−€18") and say what they mean ("over budget").

## Colors

All colours are semantic tokens. Components reference tokens only; a raw hex outside `apps/web/src/styles.css` (and the PWA manifest) is a bug. Light values are the defaults on `:root`; dark values apply under `[data-theme="dark"]` and under `prefers-color-scheme: dark` when no explicit theme is set. The front matter carries the light theme in Material role names for Stitch, plus the semantic extras; the tables below are the full specification for both themes, and `docs/design/tokens.json` is the machine-readable source the contrast gate reads.

Roles at a glance:

- **Surfaces** step by lightness, never by shadow: `surface-0` page and tab bar, `surface-1` raised (the ticket, sheets, fields, chart surface), `surface-2` sunken (segmented track, chips at rest, skeletons, the saved-data banner). The neutrals lean slightly cool (OKLCH h ≈ 250, C ≤ 0.012), the departures-board grey.
- **Ink** has three steps. `ink-1` primary text and the hero number, `ink-2` secondary text, `ink-3` labels, captions, placeholders and inactive tabs. All three pass 4.5:1 on every surface in both themes.
- **Accent** is runway orange (`#B5470C` light, `#F08A4B` dark): at least 4.57:1 on every light surface and 6.23:1 on every dark one, including `accent-soft`. Primary buttons and the FAB are accent-filled with an `accent-ink` label (4.96:1 light, 7.60:1 dark). `accent-soft` is the selection wash behind accent text.
- **Status** (`good`, `warning`, `serious`, `critical`) is reserved for feedback and always ships as a Lucide icon plus a word; the word stays in ink. `status-serious` was re-stepped from round 1 (`#A1401A` / `#F0875A`) to a darker rust and a pale peach because the round-1 dark value sat ΔE 1.9 from the dark accent (OKLab ×100); it now sits 12.5 (light) and 12.3 (dark) away.
- **Print warning** is the only tinted band: the full-width "Bring this printed" banner.
- **Offline** equals `ink-2`: calm, never an alarm.
- **Stamp ink** belongs to passport stamps only. Kiko's art colours are his own and are not tokens.
- **Chart chrome.** `gridline` and `baseline` are solid hairlines; `mark-neutral` is the single-series mark; `mark-muted` de-emphasised marks; `series-1..8` categorical slots; `neutral-100..500` an ordinal ramp.

### Light theme

| Token                             | Hex                                                                             | Use                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `--surface-0`                     | `#F5F5F2`                                                                       | Page background, tab bar; manifest `background_color` and `theme-color`.                                    |
| `--surface-1`                     | `#FBFBF9`                                                                       | Raised: the ticket card, sheets, toasts, text fields, chart surface.                                        |
| `--surface-2`                     | `#ECECE8`                                                                       | Sunken: segmented track, chips at rest, skeletons, pressed rows, saved-data banner.                         |
| `--ink-1`                         | `#111417`                                                                       | Primary text, hero number, event titles, values.                                                            |
| `--ink-2`                         | `#4A5058`                                                                       | Secondary text: city in the header, meta lines, base-currency amount.                                       |
| `--ink-3`                         | `#626971`                                                                       | Departures-board eyebrows, captions, placeholders, inactive tab labels, zone abbreviations.                 |
| `--line`                          | `#D7D8D3`                                                                       | 1px hairlines between rows and sections. Decorative only.                                                   |
| `--line-strong`                   | `#80868E`                                                                       | Boundaries that must be seen (≥ 3:1): ticket edge and perforation, field border, chip outline.              |
| `--icon`                          | `#4A5058`                                                                       | Default Lucide icon colour (= ink-2).                                                                       |
| `--accent`                        | `#B5470C`                                                                       | Runway orange. Primary button and FAB fill, links, active tab, selected segment and chip. Interaction only. |
| `--accent-ink`                    | `#F5F5F2`                                                                       | Label and icon on an accent fill.                                                                           |
| `--accent-soft`                   | `#F9EBE1`                                                                       | Selection wash behind accent text.                                                                          |
| `--focus`                         | `#B5470C`                                                                       | Focus ring: 2px solid, 2px offset in the surface colour.                                                    |
| `--status-good`                   | `#2E6B3F`                                                                       | circle-check + word: "Saved offline", "Ready to fly".                                                       |
| `--status-warning`                | `#845600`                                                                       | triangle-alert + word: stale data, a document not saved offline.                                            |
| `--status-serious`                | `#7E3418`                                                                       | octagon-alert + word: a night without lodging, over budget.                                                 |
| `--status-critical`               | `#A01C1C`                                                                       | circle-x + word: failed sync, destructive actions, field errors.                                            |
| `--print-warning`                 | `#F4E2AE`                                                                       | "Bring this printed" banner fill.                                                                           |
| `--on-print-warning`              | `#111417`                                                                       | Title, icon and action on the print banner.                                                                 |
| `--on-print-warning-2`            | `#4A5058`                                                                       | Secondary line on the print banner.                                                                         |
| `--offline`                       | `#4A5058`                                                                       | "Offline · everything saved" (= ink-2).                                                                     |
| `--stamp-ink`                     | `#2F5C8A`                                                                       | Passport stamps (trip list, empty states). Never on data.                                                   |
| `--scrim`                         | `#1114174D`                                                                     | Backdrop behind sheets. No blur.                                                                            |
| `--gridline`                      | `#E3E4DF`                                                                       | Chart gridlines, horizontal only.                                                                           |
| `--baseline`                      | `#A4ACB4`                                                                       | Chart baseline / axis rule.                                                                                 |
| `--mark-neutral`                  | `#5D646B`                                                                       | Single-series chart marks (spend per category).                                                             |
| `--mark-muted`                    | `#C3C8CD`                                                                       | "Other", previous period. Sub-3:1, always labelled.                                                         |
| `--series-1` … `--series-8`       | `#2A78D6` `#1BAF7A` `#EDA100` `#9B3F8F` `#008300` `#E87BA4` `#6250D6` `#E34948` | Categorical slots in fixed order: blue, aqua, yellow, plum, green, magenta, violet, red.                    |
| `--neutral-100` … `--neutral-500` | `#A4ACB4` `#8C939B` `#747B83` `#5D646B` `#474E55`                               | Ordinal ramp, light to dark.                                                                                |

### Dark theme

The dark theme is not an inversion. Surfaces are a cool near-black (`#0F1113` → `#17191C` → `#202326`); the accent moves to a lighter, warmer step so it keeps 6:1; `accent-ink` turns dark; status colours move to steps that read on dark; `elevation-1` becomes a hairline ring because shadows disappear on black.

| Token                             | Hex                                                                             | Use                                                          |
| --------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `--surface-0`                     | `#0F1113`                                                                       | Page background, tab bar; manifest colours in dark.          |
| `--surface-1`                     | `#17191C`                                                                       | Raised: ticket, sheets, toasts, fields, chart surface.       |
| `--surface-2`                     | `#202326`                                                                       | Sunken: tracks, chips at rest, skeletons, saved-data banner. |
| `--ink-1`                         | `#ECEDEE`                                                                       | Primary text and the hero number.                            |
| `--ink-2`                         | `#B4B9BF`                                                                       | Secondary text.                                              |
| `--ink-3`                         | `#8A9097`                                                                       | Eyebrows, captions, placeholders, inactive tabs.             |
| `--line`                          | `#2C3035`                                                                       | Hairlines. Decorative only.                                  |
| `--line-strong`                   | `#6A7079`                                                                       | Ticket edge, field border, chip outline (≥ 3:1).             |
| `--icon`                          | `#B4B9BF`                                                                       | Default icon colour.                                         |
| `--accent`                        | `#F08A4B`                                                                       | Runway orange, interaction only.                             |
| `--accent-ink`                    | `#0F1113`                                                                       | Label and icon on an accent fill.                            |
| `--accent-soft`                   | `#33200F`                                                                       | Selection wash behind accent text.                           |
| `--focus`                         | `#F08A4B`                                                                       | Focus ring.                                                  |
| `--status-good`                   | `#7CC58B`                                                                       | circle-check + word.                                         |
| `--status-warning`                | `#E2AA3A`                                                                       | triangle-alert + word.                                       |
| `--status-serious`                | `#FFB89A`                                                                       | octagon-alert + word.                                        |
| `--status-critical`               | `#F07070`                                                                       | circle-x + word.                                             |
| `--print-warning`                 | `#4D3410`                                                                       | Print banner fill.                                           |
| `--on-print-warning`              | `#ECEDEE`                                                                       | Print banner title, icon, action.                            |
| `--on-print-warning-2`            | `#B4B9BF`                                                                       | Print banner secondary line.                                 |
| `--offline`                       | `#B4B9BF`                                                                       | Offline status (= ink-2).                                    |
| `--stamp-ink`                     | `#8DB3DD`                                                                       | Passport stamps.                                             |
| `--scrim`                         | `#000000A3`                                                                     | Backdrop behind sheets.                                      |
| `--gridline`                      | `#25292D`                                                                       | Chart gridlines.                                             |
| `--baseline`                      | `#525960`                                                                       | Chart baseline.                                              |
| `--mark-neutral`                  | `#A1A9B0`                                                                       | Single-series marks.                                         |
| `--mark-muted`                    | `#3A3F45`                                                                       | De-emphasised marks, always labelled.                        |
| `--series-1` … `--series-8`       | `#3987E5` `#199E70` `#C98500` `#B766AA` `#008300` `#D55181` `#9085E9` `#E66767` | Same hues, dark steps.                                       |
| `--neutral-100` … `--neutral-500` | `#525960` `#6C727A` `#868D95` `#A1A9B0` `#BEC5CD`                               | Ordinal ramp, dark to light (the far end reads strongest).   |

Material roles in dark (for Stitch, mirrors the table): background/surface `#0F1113`, surface-container-low `#17191C`, surface-container `#202326`, surface-container-high `#2A2D31`, surface-container-highest `#33373B`, on-surface `#ECEDEE`, on-surface-variant `#B4B9BF`, outline `#6A7079`, outline-variant `#2C3035`, primary `#F08A4B`, on-primary `#0F1113`, primary-container `#33200F`, on-primary-container `#FFC8A6`, secondary `#B4B9BF`, tertiary `#8DB3DD`, error `#F07070`, on-error `#0F1113`, error-container `#3A1717`, on-error-container `#F7B8B8`, inverse-surface `#ECEDEE`, inverse-on-surface `#17191C`, inverse-primary `#B5470C`.

### Validation

- **WCAG, every single-colour token** (`node scripts/check-contrast.mjs`, which reads `docs/design/tokens.json`): 90 pairs, 0 failures. Text ≥ 4.5:1 on every surface it names, icons, meaningful borders and focus ≥ 3:1, in both themes. Weakest pairs: `line-strong` on `surface-2` 3.10:1 light / 3.16:1 dark; `accent` on `surface-2` 4.57:1 light; `ink-3` on `surface-2` 4.69:1 light. The Material roles in the front matter that are not tokens were checked with the same function: every `on-*` pair is at least 4.96:1 (`on-primary` on `primary`, light, is the weakest).
- **Series palette** (dataviz validator, chart surface `surface-1`): adjacent pairs pass in light (worst CVD ΔE 9.1, normal-vision 22.9) and dark (worst CVD ΔE 8.4, normal-vision 19.7). Slots 1–3 also pass all-pairs in both themes (worst CVD ΔE 9.1 light / 8.4 dark), which caps scatter and small multiples at three hued series. Light slots 2, 3 and 6 (aqua, yellow, magenta) sit below 3:1 on the light surface, so any chart using them shows direct labels or the table view.
- **Neutral ramp** (`neutral-100..500`): passes the ordinal checks in both themes (monotone lightness, adjacent ΔL ≥ 0.06, light end 2.22:1 light / 2.48:1 dark, hue spread 4° / 11°).
- The series order was chosen by enumerating every ordering of the eight hues and keeping the best minimum adjacent CVD distance with slot 1 cool (blue), so a single-series chart never reads as "good" or "bad". The reference orange slot was replaced by plum so no chart colour can be mistaken for the accent.
- Status colours are a severity scale, not categorical identity: checked with WCAG plus the icon-and-word rule, never placed side by side as unlabelled fills.

## Typography

Two families from one superfamily, self-hosted woff2 (`apps/web/public/fonts/`, precached by the service worker), `font-display: swap`:

- **IBM Plex Sans** 400 / 500 / 600 for all text. Fallback `"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif`.
- **IBM Plex Mono** 400 / 500 for anything that reads like a ticket: IATA codes, times, countdowns, booking references, route chips and the departures-board eyebrows. Fallback `"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace`.
- Local-script addresses (Greek, Thai, Japanese…) use the system font: Plex ships Latin only.

| Style          | Family | Size / line | Weight | Tracking | Use                                                                       |
| -------------- | ------ | ----------- | ------ | -------- | ------------------------------------------------------------------------- |
| `display`      | Sans   | 40 / 48     | 600    | −0.01em  | The one hero number per screen: "Left today", the quick-expense amount.   |
| `title`        | Sans   | 24 / 32     | 600    | −0.005em | Screen titles; "Day 4 of 12".                                             |
| `heading`      | Sans   | 18 / 24     | 600    | 0        | Section titles, event title on the ticket, lodging name, sheet titles.    |
| `body`         | Sans   | 16 / 24     | 400    | 0        | Running text, row titles (at 500), field values.                          |
| `body-strong`  | Sans   | 16 / 24     | 500    | 0        | Button labels, "Leave at 13:40", emphasis.                                |
| `label`        | Sans   | 13 / 16     | 500    | +0.01em  | Chips, segmented options, field labels, status words.                     |
| `caption`      | Sans   | 12 / 16     | 400    | +0.01em  | Row metadata, helper text, tab labels (at 500), axis ticks.               |
| `code-display` | Mono   | 24 / 32     | 500    | +0.02em  | Route and departure time on the ticket.                                   |
| `code`         | Mono   | 16 / 24     | 500    | 0        | Event times in rows, booking references.                                  |
| `code-label`   | Mono   | 13 / 16     | 500    | +0.04em  | Route chips `PVM → ALD`.                                                  |
| `eyebrow`      | Mono   | 12 / 16     | 500    | +0.08em  | Uppercase section labels in `ink-3` ("NEXT", "TONIGHT"). One per section. |

Figures:

- **Tabular figures everywhere numbers align or change**: times, countdowns, amounts, dates, counts, axis ticks, the keypad (`font-variant-numeric: tabular-nums`). Mono is tabular by construction.
- The hero number keeps tabular figures too (it changes while you type in the keypad); tight tracking (−0.01em) keeps it from looking loose.
- Weight 600 is the ceiling; no bold 700, no italic in UI.
- Headings use `text-wrap: balance`; running text stays near 65 characters.

## Layout & Spacing

- **Grid.** 8 px base with a 4 px half step for icon-to-label gaps. Tokens: `space-half` 4, `space-1` 8, `space-2` 16, `space-3` 24, `space-4` 32, `space-6` 48.
- **Frame.** Designed at 390 × 844 with iOS safe areas (47 px top, 34 px home indicator). Side gutter 16 px plus `env(safe-area-inset-*)`. On wider screens a single centred column, max 480 px.
- **Rows.** List rows 56 px minimum (48 px for single-line event rows), section eyebrows 16 px, table-view rows 44 px.
- **Tap targets.** 44 px minimum, 48 px for primary controls and the FAB. A smaller visual (a 36 px button, a 20 px copy icon) gets an invisible hit area that reaches 44.
- **Shell.** Header: title (or "Day N of M · city"), connection status beneath it, Kiko `sm` at the right on Today only. Bottom tab bar: Today · Plan · Docs · Money · More, 56 px + the bottom safe area. The expense FAB floats 16 px above the tab bar at the right, on every trip screen except settings.
- **Vertical rhythm.** Sections are separated by one `line` hairline and 8–16 px of padding, never boxed. Eyebrow → content 4 px; related controls 8 px.

Screen skeletons the system is tuned for:

- **Today** (the sacred screen), top to bottom: (1) "Day 4 of 12 · city", connection status, Kiko `sm`; (2) the ticket: title, local time, countdown, "Leave at", route chip and booking reference on the stub, "Directions"; (3) today's documents with offline state, the full-width print banner first when a document must be printed, hidden when there are none; (4) tonight: name, large copyable address, local-script address, check-in, phone, "Directions"; no lodging is a `status-serious` alert; (5) left today: hero in local currency, base currency and pending count below; negative in words, never decorative red; (6) weather with its age, hidden without data; (7) the expense FAB.
- **Itinerary day** (Plan · Days): date heading with "Day N of M", the day's route chips, then event rows with a 64 px mono time column (local time over the zone abbreviation), title, meta and a "Directions" link; lodging appears as check-out and check-in rows ("Night 1 of 2") and an all-day bed row on the middle days; an empty day is an honest "Free day" with one action.

## Elevation & Depth

Flat by default. Depth comes from surface steps and hairlines, never from heavy shadow, gradients or blur.

| Level    | Light                                                     | Dark                             | Used by                                                    |
| -------- | --------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| 0        | `surface-0`                                               | `surface-0`                      | Page, lists, charts.                                       |
| 0 raised | `surface-1` + 1px `line-strong` edge                      | same                             | The ticket card only; fields use the same edge. No shadow. |
| 1        | `surface-1` + `0 1px 2px #1114170F, 0 6px 16px #11141714` | `surface-1` + 1px `#2C3035` ring | Bottom sheets, toasts, the FAB: the only floating things.  |

- Sheets sit over `scrim`. No backdrop blur, no glass.
- Nothing is ever more than one step above what is behind it. No cards inside cards, no border plus shadow plus fill on one element.

## Shapes

| Token                    | Value  | Use                                                                    |
| ------------------------ | ------ | ---------------------------------------------------------------------- |
| `rounded.sm`             | 4px    | Chips (route, filter, status), badges, bar data-ends, skeleton blocks. |
| `rounded.DEFAULT` / `md` | 8px    | Buttons, text fields, segmented control, the ticket card.              |
| `rounded.lg`             | 12px   | FAB, toasts, empty-state icon square.                                  |
| `rounded.xl`             | 16px   | Top corners of bottom sheets only.                                     |
| `rounded.full`           | 9999px | Status dots, progress-track ends, the sheet handle. Nothing else.      |

- **The perforation.** The ticket's notches are 8 px half-circles cut by an SVG `<mask>` at the stub line, with a dashed `line-strong` hairline (4/4) between them. Never a gradient, never an image.
- **Icons.** Lucide only, stroke 1.75, round caps and joins, 20 px in rows and buttons, 16 px inline with labels, 24 px in the tab bar, coloured with `currentColor` from an ink or status token. No emoji as icons, no second icon set.
- No pill buttons or pill chips; no radii outside 4 / 8 / 12 / 16.

## Motion

Motion is restrained and functional. Only these things move:

| What                               | Duration      | Easing                                  | Behaviour                                                             |
| ---------------------------------- | ------------- | --------------------------------------- | --------------------------------------------------------------------- |
| Bottom sheet enter / exit          | 200ms / 150ms | `cubic-bezier(0.2, 0, 0, 1)` (ease-out) | Translates up from the bottom edge; scrim fades in.                   |
| Toast                              | 150ms         | ease-out                                | Fades in while rising 8 px; auto-dismiss after 5 s (8 s with "Undo"). |
| Segment change                     | 150ms         | ease-out                                | The thumb slides to the new option.                                   |
| Pressed states (button, chip, FAB) | 150ms         | ease-out                                | Background colour only.                                               |
| Kiko                               | 4–6 fps       | steps()                                 | Sprite loop of the current state; Today header and empty states only. |

- Everything else changes instantly: no page transitions, no count-ups, no chart grow-in, no parallax, no hover lifts.
- `prefers-reduced-motion: reduce`: sheets and toasts appear without translation (opacity only, 100 ms), segment thumbs jump, Kiko shows his `still` frame. Nothing conveys meaning through motion alone.

## Components

Every component lives in `apps/web/src/app/shared/ui/` with the `mk-` prefix, styles itself only through tokens, supports both themes and shows the focus ring (`outline: 2px solid var(--focus); outline-offset: 2px`).

### Button

- **Primary**: `accent` fill, `accent-ink` label at 600, radius 8, 44 px (48 px `block` at the bottom of a sheet). At most one per screen.
- **Secondary**: `surface-1` fill, 1px `line-strong`, `ink-1` label at 500. "Directions" is a secondary button with the `navigation` icon.
- **Quiet / link**: no fill or border, `accent` label at 600 ("I printed it", "Undo"). On the print banner the link takes `on-print-warning` and an underline.
- **Destructive**: secondary with a `status-critical` label; never a red fill.
- **Disabled**: `surface-2` fill, `line` border, `ink-3` label, with a sentence nearby that says why.
- **Sizes**: 44 default, `sm` 36 with a 44 px hit area, icons 20 / 16.

### Text field

- Label above in `label` / `ink-2` (never placeholder-only), 48 px field on `surface-1` with 1px `line-strong` and radius 8, value in `body`.
- Mono variant for booking references and codes (`code`, tabular, +0.02em).
- Help below in `caption` / `ink-3`. Error: border and message in `status-critical` with circle-x and a sentence that says how to fix it.
- Amounts are never typed in a text field: the quick-expense sheet has its own keypad.

### List row

- 56 px minimum, 1px `line` between rows, never boxed; leading Lucide icon in `icon`, title in `body` at 500 (ellipsis), meta in `caption` / `ink-3`, trailing value, status (icon in status colour + word in `ink-2`) or chevron.
- **Event row**: a 64 px mono time column (local time in `code`, zone abbreviation below in `ink-3`), title, meta, and an optional "Directions" link with the `navigation` icon.
- **Lodging rows**: check-out and check-in as event rows with "Night N of M" in the meta; middle days show an all-day row with the `bed-double` icon.
- The whole row is one target; nested actions get their own 44 px targets.

### Ticket card

- The next event on Today, 358 × 172 at 390 width: `surface-1` paper, 1px `line-strong` edge, radius 8, perforation at 108 px (two 8 px notches cut by an SVG mask plus a dashed `line-strong` hairline).
- Top part: title (`heading`), departure time (`code-display`, zone only when it differs from the device), countdown in `ink-2` ("in 1 h 32 min"), "Leave at 13:40" with the clock icon.
- Stub: route in `code-display` (`PVM → ALD`, arrow in `ink-3`), booking reference in `code-label` / `ink-2`, and the "Directions" secondary button.
- One ticket per screen. No gradient, no shadow, no accent on the paper.

### Segmented control

- Two to four mutually exclusive views ("Days | Where we sleep", "Chart | Table"). Track `surface-2`, radius 8, 2 px inset; selected thumb `surface-1` with a 1px `line-strong` ring and the label in `accent` at 600; others `ink-2`.
- 40 px track, 36 px segments, whole segment is the target. `role="tablist"` / `tab` with `aria-selected`.

### Bottom sheet

- Everything modal: quick expense, event detail, "Pending". `surface-1`, top corners 16, level 1, over `scrim`, 36 × 4 handle in `line-strong`.
- Title in `heading` with a 44 px close button (`aria-label`), content, at most one `block` primary button 16 px above the safe area.
- **Quick expense in ≤ 3 taps**: FAB → sheet with the keypad focused and the amount as the `display` number (currency of today's country) → optional category chip → "Save" (writes to Dexie, toast with undo).

### Chip

- 32 px, radius 4, 1px `line-strong` on `surface-1`, `label` text, optional 16 px icon. Selected filter chip: `accent-soft` fill, `accent` border and label at 600.
- **Route chip** (`code-label`, 28 px, transparent fill): `PVM → ALD`, arrow in `ink-3`. It is data, so it is never accent. A trip summary strings them: `PVM → ALD → KSB`.
- **Status chip**: `surface-2` fill, `line` border, status icon + word in ink.

### Stat tile

- Up to three in a row, separated by vertical `line` hairlines, no boxes: eyebrow, value in `title` (tabular), sub-line in `caption` / `ink-2` (base currency, "of €300").
- Values stay in ink; a negative uses U+2212 and says what it means.

### Empty state

- Centred: Kiko `md` (96 px) in the fitting state, or a 24 px icon in a 48 px `surface-2` square (radius 12); title in `heading`; one sentence in `ink-2`; one primary or secondary button.
- In a list (an empty itinerary day), the compact form: Kiko `md` at the left, title, sentence and one button at the right.
- No fake data, no spinner when there is simply nothing yet, no second action.

### Toast

- `surface-1`, 1px `line`, radius 12, level 1, 16 px above the tab bar or the FAB; status icon, one sentence in ink (`label` 14/20), one quiet action ("Undo").
- Offline saves say so: "Expense saved · will sync when online".

### Banner

- Full width (edge to edge, no radius, no border), 12 px vertical padding, icon + bold line + optional `caption` line + optional action.
- **Print this** (`mk-banner--print`): `print-warning` fill, printer icon, "Bring this printed", the document name in `on-print-warning-2`, "I printed it" as an underlined link in `on-print-warning`. First item of today's documents; hidden once confirmed.
- **Saved data**: `surface-2`, wifi-off, "Showing saved data · last synced today at 09:12".
- **Critical**: `surface-2`, circle-x in `status-critical`, sentence in ink, opens the Pending sheet.

### Progress

- 4 px track in `surface-2`, `ink-1` fill, rounded ends, with the count written next to the label ("12 of 18"). Never accent, never status colour: progress reports, it is not a control.
- **Steps** variant for checklists ("Ready to fly 5 of 7"): equal segments, 2 px gaps.

### Tab bar

- Five tabs: Today · Plan · Docs · Money · More. 56 px + bottom safe area, `surface-0`, 1px `line` on top. 24 px icon over a 12 px label; inactive `ink-3`, active `accent` at 600 with `aria-current="page"`.
- No numeric badges; pending work shows in the connection status.

### Connection status

- One line under the header title, by priority: failed > offline > syncing > pending > stale > synced (hidden).
- **offline**: wifi-off + "Offline · everything saved" in `offline`. **syncing**: refresh-cw + "Syncing 3…". **pending**: 8 px `ink-3` dot + "3 pending". **stale** (> 24 h): clock in `status-warning` + "Data from 2 days ago". **failed**: circle-x in `status-critical` + "1 expense needs attention" in ink, opens the Pending sheet.

### Mascot slot

- `<mk-mascot [state] size="sm|md|lg" [label]>`: 48 / 96 / 160 px. States `happy, worried, excited, asleep, celebrating, thinking`.
- Kiko appears only in the Today header (`sm`), empty states and loading (`md`), and onboarding (`lg`). Never next to money, never on a chart, never as decoration on data.
- `aria-hidden` without a label, `role="img"` with one; animated from the sprite sheet, `still` frame under reduced motion. Kiko's art colours are his own and are not UI tokens.

### Passport stamp

- The reward on the trip list (from direction A): 112 px, two rings (2px and 1px) in `stamp-ink`, place name in mono caps, a short code, the date; rotated a few degrees (−8° to +8°, stable per place).
- A place not reached yet is a dashed `ink-3` ring with "Not yet".
- Stamps appear only on the trip list and in empty states; never on Today, money or charts. A generated fallback is used when no artwork exists for the place.

## Charts

Charts are drawn in SVG from the same tokens as the UI. The rules below are non-negotiable.

**Marks**

- Bars at most 24 px thick (the budget's category bars are 12 px); 4 px rounded data-end, square at the baseline; one baseline.
- 2 px surface-coloured gaps between stacked segments and touching bars; never outline a mark to separate it.
- Lines 2 px with round joins; markers at least 8 px with a 2 px ring in the surface colour.
- Gridlines 1px solid `gridline`, horizontal only; baseline 1px solid `baseline`. Never dashed.

**Colour**

- One series uses `mark-neutral` and needs no legend; the title names it. Spending per category is single-series.
- Multi-series categorical charts use `series-1..8` in fixed order, assigned by entity and never by rank, so a filter never repaints survivors. Cap at six hued series plus "Other" in `mark-muted`; scatter and small multiples cap at three.
- Ordered buckets use `neutral-100..500`. No rainbow scales, no hue at a diverging midpoint.
- The accent is never a mark. Status colours appear in a chart only when the mark means good or bad (a budget meter), always with icon and word.

**Text and structure**

- One value axis. Never dual axes, never donut or pie, no 3D, no gradients, no animated grow-in.
- Ticks round to clean values in `caption` tabular / `ink-3`. Legend above the plot for two or more series; selective direct labels.
- Text is never set in a series colour.
- **Every chart has a table view** behind a segmented "Chart | Table" control; tooltips enhance and never gate a value.

**Interaction**

- Tap or hover a bar for its tooltip (`surface-1`, level 1, radius 8); hit areas cover the whole band, at least 44 px. Filters live in one row above the charts they scope.

## Do's and Don'ts

**Do**

- Lead Today with the ticket: what happens next, when to leave, how to get there.
- Set codes, times, countdowns and booking references in IBM Plex Mono with tabular figures.
- Use the accent only for the primary button, the FAB, links, the active tab, selected segments and chips, and the focus ring.
- Separate content with whitespace and 1px `line` hairlines; keep the ticket the only card on a screen.
- Pair every status colour with a Lucide icon and a word in ink.
- Show the place's local time and, when it differs from the device, the zone abbreviation.
- Say "Offline · everything saved" calmly and show how old cached data is.
- Give every chart a table view; keep Kiko and the stamps away from data.
- Write copy in en-AU and es-MX, day-first dates, true minus sign, "you" and "{partner}".
- Design the dark theme with its own steps and run `node scripts/check-contrast.mjs` after any colour change.

**Don't**

- No gradients, glassmorphism, backdrop blur, glows or neon, anywhere.
- No default purple or indigo as a UI colour; no second accent; no accent on data, charts or status.
- No emoji as icons, no mixed icon sets, no decorative illustrations beyond Kiko and the stamps.
- No shadows beyond level 1, no cards inside cards, no border plus shadow plus fill on one element.
- No pill buttons or chips, no radii outside 4 / 8 / 12 / 16.
- No donut, pie, 3D or dual-axis charts; no dashed gridlines; no number on every data point; no chart without a table view.
- No red for spending or for being over budget: say it in words.
- No motion beyond sheets, toasts, segment changes and Kiko; no count-ups.
- No real names, cities, booking codes or domains in mocks or copy.
