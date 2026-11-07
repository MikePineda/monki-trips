# Design decisions

Dated log of the design gates. Product decisions belong to the owner; this
file records what was proposed, what was chosen and why. No personal data.

## 2026-11-07 · Round 1 proposed

Work package 0.4 (D0 + D1). Proposed for the owner's review on a phone, as
PNGs embedded in the pull request `docs(design): round 1`:

- **Directions** (`docs/design/proposals/<direction>/`), each with the Today
  screen in light and dark and a `palette.md` that passes the contrast gate:
  - **A Notebook**: warm paper, ink and one ink-blue accent; Fraunces for
    display, Inter for text, IBM Plex Mono for codes. Hairlines, a taped note
    for the next event; tape and stamps live only on the mascot, the stamps
    and the empty states.
  - **B Boarding pass**: cool off-white, near-black ink and a runway-orange
    accent; IBM Plex Sans with IBM Plex Mono for IATA codes, times and
    booking references. The next event is a ticket card whose perforation is
    an SVG mask, no gradient.
  - **C Pixel**: clean neutral surfaces, jungle-green accent, Atkinson
    Hyperlegible Next for the UI. A 16-colour palette belongs to the sprite
    mascot and the stamps only; a pixel font appears inside stamps only. The
    sprite walks along the day strip.
- **Mascots** (`docs/design/mascots/<id>/`), six states each (happy, worried,
  excited, asleep, celebrating, thinking), original SVG art:
  - **Kiko**, a travelling monkey with a huge backpack and a passport sticking
    out ("monki" family).
  - **Golo and Lina**, a pair of swallows that always return to the same
    nest.
  - **Tag and Tug**, two luggage tags on one string.
- **Recommendation** (the owner decides): B Boarding pass as the structure,
  A's stamps as the reward, with Kiko as the mascot.
- Tooling: `scripts/design-shots.mjs` (renders, blocks every non-`file://`
  request) and `scripts/check-contrast.mjs` (contrast over each `palette.md`).

### Decisions the plan did not cover

- The contrast gate reads the `## Tokens` table of each `palette.md` instead
  of a single `docs/design/tokens.json`: one file per direction keeps each
  proposal self-contained; D2 will emit `tokens.json` for the chosen one.
- Hairline separators (`line`) are declared `decorative` and exempt from the
  3:1 rule; `line-strong` (inputs, chips, meaningful boundaries) is `graphic`
  and must pass it.
- Mascot concept sheets are 390×844 portrait with the six states in a
  two-column grid, so they read on a phone at the same size as the screens.
- Fonts for the proposals are self-hosted from `@fontsource/*` (OFL 1.1) under
  `docs/design/proposals/fonts/`, not under `apps/web/public/fonts/`, until
  the direction is chosen.

## Round 1 decision

Recorded on 2026-11-07, below.

## 2026-11-07 · Round 1 decision: B boarding pass + Kiko; stamps from A as reward

The owner picked direction **B Boarding pass** with **Kiko** as the mascot,
keeping direction A's **passport stamps** as the reward on the trip list
(pull request #8). Work package 0.7a turned it into the design system
(`docs/design/DESIGN.md`, `docs/design/tokens.json`, `docs/design/README.md`)
and private Claude Design artifacts (a Design System plus the Today and
Itinerary day canvases, light and dark), kept by the owner.

Facts fixed by the design system:

- **Accent** runway orange, interaction only: light `#B5470C` (4.57:1 or
  more on every light surface, 4.97:1 on `surface-0`), dark `#F08A4B` (6.23:1
  or more, 7.61:1 on `surface-0`); label on an accent fill `accent-ink`
  `#F5F5F2` / `#0F1113`. Primary buttons and the FAB are accent-filled.
- **Surfaces** `#F5F5F2` / `#FBFBF9` / `#ECECE8` light, `#0F1113` /
  `#17191C` / `#202326` dark; ink `#111417` / `#4A5058` / `#626971` light,
  `#ECEDEE` / `#B4B9BF` / `#8A9097` dark (round-1 values unchanged).
- **Fonts** IBM Plex Sans 400/500/600 for text, IBM Plex Mono 400/500 for
  codes, times, countdowns, booking references and eyebrows; scale 40 / 24 /
  18 / 16 / 13 / 12; tabular figures wherever numbers align.
- **Radii** 4 (chips) / 8 (buttons, fields, ticket) / 12 (FAB, toasts),
  sheets 16; 8 px grid; one elevation step; Lucide 1.75 px.
- **Changed from round 1:** `status-serious` re-stepped to `#7E3418` light
  and `#FFB89A` dark (the round-1 dark value sat ΔE 1.9 from the dark accent).
- **Added:** `accent-soft`, `offline` (= ink-2), `stamp-ink`, `scrim`, chart
  chrome, `series-1..8` (blue, aqua, yellow, plum, green, magenta, violet,
  red; no orange so data never looks like the accent) and an ordinal
  `neutral-100..500` ramp, all validated (see `docs/design/README.md`).

### Decisions the brief did not cover

- `tokens.json` uses the Design System artifact's shape (`color.tokens` as a
  list of `{ name, value: { light, dark }, usage }`) plus `role` and
  `against`, so one file feeds the artifact, the contrast gate and, next,
  `styles.css`. The contrast gate learned two roles without a single-colour
  requirement: `series` (validated by the dataviz validator) and `overlay`
  (translucent scrims).
- Status words stay in ink; only the icon takes the status colour.
- The ticket's "Directions" is a secondary button so the FAB is the only
  filled control on Today.
- Weather sits beside "Left today" (same row, after it in reading order) so
  Today fits one 390 × 844 screen above the FAB.
