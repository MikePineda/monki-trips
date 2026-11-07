# Design system (D2)

The design system of monki-trips after the round-1 decision: direction
**B Boarding pass** with **Kiko** as the mascot and direction A's passport
stamps as the reward on the trip list. The specification is
[`DESIGN.md`](DESIGN.md) (Stitch format); the machine-readable tokens are
[`tokens.json`](tokens.json); the decision log is
[`DECISIONS.md`](DECISIONS.md).

## Pipeline

1. **Brief and round 1** (`BRIEF.md`, `proposals/`, `mascots/`, PR #8): three
   directions and three mascots; the owner picked B + Kiko.
2. **Tokens**: derived from `proposals/boarding-pass/palette.md`, extended
   with selection, focus, offline, stamp, chart and overlay tokens, and one
   re-stepped colour (`status-serious`, see Rationale). Written to
   `tokens.json` (Design System shape plus `role` and `against` per colour).
3. **Validation**: the dataviz palette validator for the chart colours, and
   `scripts/check-contrast.mjs` (now reading `tokens.json` as well as each
   `palette.md`) for every single-colour token in both themes. Outputs below.
4. **Artifacts** (Claude Design, private): a Design System artifact
   ("monki-trips design system": tokens, type, 16 ui-kit components with
   live previews in both themes, cover) and two Design canvases built on it,
   **Today** and **Itinerary day**, each with a light and a dark 390 × 844
   artboard with iOS safe areas and the tab bar. The artifacts are kept
   privately by the owner; their links are not in this public repository.
5. **`DESIGN.md`** in the Stitch format: front matter with the Material roles
   (light) plus semantic and domain extras, then brand, colours (both
   themes and validation), type, layout, elevation, shapes, motion, one
   section per ui-kit component, charts, and do's and don'ts.
6. **In code (WP 0.7)**: tokens in `apps/web/src/styles.css`
   (`core/theme/tokens.spec` keeps them equal to `tokens.json`), the `mk-*`
   ui-kit in `apps/web/src/app/shared/ui/`, `/styleguide` with the mock
   screens, PNGs from `e2e/tests/styleguide.visual.spec.ts` (J09) under
   `e2e/screenshots/styleguide/`, and the `design-approved` gate (stop 2).

## How to re-skin

The front is built so a redesign touches three places and nothing else
(`architecture.spec` fails when a feature carries its own styles):

1. **Tokens.** Change the values in `docs/design/tokens.json`, run
   `node scripts/check-contrast.mjs` (text 4.5:1, icons and borders 3:1 in
   both themes), then copy the values into `apps/web/src/styles.css`
   (light on `:root`, dark twice: `[data-theme='dark']` and
   `prefers-color-scheme`). `apps/web/src/app/core/theme/tokens.spec.ts`
   fails until the two files agree; the spacing scale `space-half`,
   `space-1..8`, the radii, the elevation and the motion tokens live in the
   same file. `public/manifest.webmanifest` takes the light `surface-0`.
2. **Fonts.** Put the woff2 files and their licences under
   `apps/web/public/fonts/`, list them in `tokens.json` (`type.fonts`) and
   in the `@font-face` rules of `styles.css` (`font-display: swap`); the
   service worker already prefetches `/fonts/**`.
3. **Assets.** The mascot under `apps/web/public/mascot/<id>/` (`sheet.svg`
   or `sheet.png`, `sheet.json`, `LICENSE.md`; point `active.json` at it;
   `mascot-sheet.spec.ts` validates the contract) and the stamp artwork
   under `apps/web/public/stamps/` (`<code>.svg`, monochrome, listed in
   `stamps.json`).
4. **Check.** `npm run verify:quick`, then open `/styleguide` (both themes,
   both languages) and run J09
   (`npm run e2e -- -- --project=mobile-chromium --grep J09`) to refresh the
   PNGs. `src/testing/theme-alt.spec.ts` mounts the mock screens with a
   second theme and fails on any colour, radius or shadow that does not
   resolve through a token.

Components change only in `shared/ui`; features never carry colour, radius,
shadow or font utilities, inline styles, raw `<button>`/`<input>` or their
own styles.

## Tokens

Contrast is WCAG 2 against the surfaces each token names in `tokens.json`
(the minimum over those surfaces); `text` needs 4.5:1, `graphic` 3:1;
`surface`, `decorative`, `series` and `overlay` have no single-colour
requirement (series are validated below).

| Token                | Light       | Dark        | Role       | Min ratio light | Min ratio dark |
| -------------------- | ----------- | ----------- | ---------- | --------------- | -------------- |
| `surface-0`          | `#F5F5F2`   | `#0F1113`   | surface    | —               | —              |
| `surface-1`          | `#FBFBF9`   | `#17191C`   | surface    | —               | —              |
| `surface-2`          | `#ECECE8`   | `#202326`   | surface    | —               | —              |
| `ink-1`              | `#111417`   | `#ECEDEE`   | text       | 15.60:1         | 13.47:1        |
| `ink-2`              | `#4A5058`   | `#B4B9BF`   | text       | 6.87:1          | 7.99:1         |
| `ink-3`              | `#626971`   | `#8A9097`   | text       | 4.69:1          | 4.90:1         |
| `line`               | `#D7D8D3`   | `#2C3035`   | decorative | —               | —              |
| `line-strong`        | `#80868E`   | `#6A7079`   | graphic    | 3.10:1          | 3.16:1         |
| `icon`               | `#4A5058`   | `#B4B9BF`   | graphic    | 6.87:1          | 7.99:1         |
| `accent`             | `#B5470C`   | `#F08A4B`   | text       | 4.57:1          | 6.23:1         |
| `accent-ink`         | `#F5F5F2`   | `#0F1113`   | text       | 4.96:1          | 7.60:1         |
| `accent-soft`        | `#F9EBE1`   | `#33200F`   | surface    | —               | —              |
| `focus`              | `#B5470C`   | `#F08A4B`   | graphic    | 4.57:1          | 6.23:1         |
| `status-good`        | `#2E6B3F`   | `#7CC58B`   | text       | 5.38:1          | 7.68:1         |
| `status-warning`     | `#845600`   | `#E2AA3A`   | text       | 5.35:1          | 7.55:1         |
| `status-serious`     | `#7E3418`   | `#FFB89A`   | text       | 7.41:1          | 9.45:1         |
| `status-critical`    | `#A01C1C`   | `#F07070`   | text       | 6.62:1          | 5.45:1         |
| `print-warning`      | `#F4E2AE`   | `#4D3410`   | surface    | —               | —              |
| `on-print-warning`   | `#111417`   | `#ECEDEE`   | text       | 14.37:1         | 9.87:1         |
| `on-print-warning-2` | `#4A5058`   | `#B4B9BF`   | text       | 6.33:1          | 5.86:1         |
| `offline`            | `#4A5058`   | `#B4B9BF`   | text       | 6.87:1          | 7.99:1         |
| `stamp-ink`          | `#2F5C8A`   | `#8DB3DD`   | text       | 5.87:1          | 7.23:1         |
| `scrim`              | `#1114174D` | `#000000A3` | overlay    | —               | —              |
| `gridline`           | `#E3E4DF`   | `#25292D`   | decorative | —               | —              |
| `baseline`           | `#A4ACB4`   | `#525960`   | decorative | —               | —              |
| `mark-neutral`       | `#5D646B`   | `#A1A9B0`   | graphic    | 5.79:1          | 7.39:1         |
| `mark-muted`         | `#C3C8CD`   | `#3A3F45`   | decorative | —               | —              |
| `series-1`           | `#2A78D6`   | `#3987E5`   | series     | —               | —              |
| `series-2`           | `#1BAF7A`   | `#199E70`   | series     | —               | —              |
| `series-3`           | `#EDA100`   | `#C98500`   | series     | —               | —              |
| `series-4`           | `#9B3F8F`   | `#B766AA`   | series     | —               | —              |
| `series-5`           | `#008300`   | `#008300`   | series     | —               | —              |
| `series-6`           | `#E87BA4`   | `#D55181`   | series     | —               | —              |
| `series-7`           | `#6250D6`   | `#9085E9`   | series     | —               | —              |
| `series-8`           | `#E34948`   | `#E66767`   | series     | —               | —              |
| `neutral-100`        | `#A4ACB4`   | `#525960`   | series     | —               | —              |
| `neutral-200`        | `#8C939B`   | `#6C727A`   | series     | —               | —              |
| `neutral-300`        | `#747B83`   | `#868D95`   | series     | —               | —              |
| `neutral-400`        | `#5D646B`   | `#A1A9B0`   | series     | —               | —              |
| `neutral-500`        | `#474E55`   | `#BEC5CD`   | series     | —               | —              |

Typography: IBM Plex Sans 400/500/600 for text, IBM Plex Mono 400/500 for
codes, times, countdowns, booking references and eyebrows; scale display
40 / title 24 / heading 18 / body 16 / label 13 / caption 12 (mono
code-display 24, code 16, code-label 13, eyebrow 12). Spacing on an 8 px
grid with a 4 px half step. Radii 4 / 8 / 12, sheets 16. One elevation step.
Motion 150–200 ms ease-out, opacity only under reduced motion. Lucide icons
at 1.75 px.

## Validator output

### Contrast gate (`node scripts/check-contrast.mjs`)

```text
ok    docs/design/proposals/boarding-pass/palette.md: 19 tokens, 62 pairs checked
ok    docs/design/proposals/notebook/palette.md: 19 tokens, 62 pairs checked
ok    docs/design/proposals/pixel/palette.md: 19 tokens, 62 pairs checked
ok    docs/design/tokens.json: 40 tokens, 90 pairs checked
exit 0
```

### Chart palette (dataviz `validate_palette.js`)

Series in light and dark on the chart surface (`surface-1`), the first three
slots with `--pairs all`, and the five-step neutral ramp with `--ordinal`.
Every run exits 0; the light-mode contrast WARN (three slots under 3:1 on
the light surface) is the documented relief case: those charts carry direct
labels or the table view, which every chart has anyway.

```text
$ node validate_palette.js #2A78D6,#1BAF7A,#EDA100,#9B3F8F,#008300,#E87BA4,#6250D6,#E34948 --mode light --surface #FBFBF9

Palette (light, surface #FBFBF9, categorical): 8 slots
  [PASS] Lightness band         all 8 inside L 0.43–0.77
  [PASS] Chroma floor           all 8 >= 0.1
  [PASS] CVD separation         worst adjacent #EDA100↔#1BAF7A ΔE 9.1 (protan) · tritan 9.6
  [PASS] Normal-vision floor    worst adjacent #EDA100↔#1BAF7A ΔE 22.9 (normal)
  [WARN] Contrast vs surface    below 3:1 — relief required (visible labels or table view): [["#1BAF7A",2.72],["#EDA100",2.09],["#E87BA4",2.6]]

  → ALL CHECKS PASS  (CVD in the 6–8 floor band is legal ONLY with secondary encoding: direct labels, gaps, or texture)

exit 0
$ node validate_palette.js #3987E5,#199E70,#C98500,#B766AA,#008300,#D55181,#9085E9,#E66767 --mode dark --surface #17191C

Palette (dark, surface #17191C, categorical): 8 slots
  [PASS] Lightness band         all 8 inside L 0.48–0.67
  [PASS] Chroma floor           all 8 >= 0.1
  [PASS] CVD separation         worst adjacent #C98500↔#199E70 ΔE 8.4 (protan) · tritan 4.0
  [PASS] Normal-vision floor    worst adjacent #9085E9↔#D55181 ΔE 19.7 (normal)
  [PASS] Contrast vs surface    all 8 >= 3:1

  → ALL CHECKS PASS  (CVD in the 6–8 floor band is legal ONLY with secondary encoding: direct labels, gaps, or texture)

exit 0
$ node validate_palette.js #2A78D6,#1BAF7A,#EDA100 --mode light --surface #FBFBF9 --pairs all

Palette (light, surface #FBFBF9, categorical): 3 slots
  [PASS] Lightness band         all 3 inside L 0.43–0.77
  [PASS] Chroma floor           all 3 >= 0.1
  [PASS] CVD separation         worst all-pairs #EDA100↔#1BAF7A ΔE 9.1 (protan) · tritan 9.6
  [PASS] Normal-vision floor    worst all-pairs #EDA100↔#1BAF7A ΔE 22.9 (normal)
  [WARN] Contrast vs surface    below 3:1 — relief required (visible labels or table view): [["#1BAF7A",2.72],["#EDA100",2.09]]

  → ALL CHECKS PASS  (CVD in the 6–8 floor band is legal ONLY with secondary encoding: direct labels, gaps, or texture)

exit 0
$ node validate_palette.js #3987E5,#199E70,#C98500 --mode dark --surface #17191C --pairs all

Palette (dark, surface #17191C, categorical): 3 slots
  [PASS] Lightness band         all 3 inside L 0.48–0.67
  [PASS] Chroma floor           all 3 >= 0.1
  [PASS] CVD separation         worst all-pairs #C98500↔#199E70 ΔE 8.4 (protan) · tritan 4.0
  [PASS] Normal-vision floor    worst all-pairs #C98500↔#199E70 ΔE 19.8 (normal)
  [PASS] Contrast vs surface    all 3 >= 3:1

  → ALL CHECKS PASS  (CVD in the 6–8 floor band is legal ONLY with secondary encoding: direct labels, gaps, or texture)

exit 0
$ node validate_palette.js #A4ACB4,#8C939B,#747B83,#5D646B,#474E55 --ordinal --mode light --surface #FBFBF9

Palette (light, surface #FBFBF9, ordinal ramp): 5 slots
  [PASS] Lightness monotone     steps read light→dark
  [PASS] Adjacent ΔL            all gaps >= 0.06
  [PASS] Light-end contrast     #A4ACB4 at 2.22:1 vs surface
  [PASS] Single hue             hue spread 4°

  → ALL CHECKS PASS  (ordinal: one hue, monotone L, visible step gaps, light end clears surface)
exit 0
$ node validate_palette.js #525960,#6C727A,#868D95,#A1A9B0,#BEC5CD --ordinal --mode dark --surface #17191C

Palette (dark, surface #17191C, ordinal ramp): 5 slots
  [PASS] Lightness monotone     steps read light→dark
  [PASS] Adjacent ΔL            all gaps >= 0.06
  [PASS] Light-end contrast     #525960 at 2.48:1 vs surface
  [PASS] Single hue             hue spread 11°

  → ALL CHECKS PASS  (ordinal: one hue, monotone L, visible step gaps, light end clears surface)
exit 0
```

## Rationale

- B gives itinerary data (codes, times, references) the structure it needs;
  mono with tabular figures makes a ticket readable at a counter.
- One accent kept strictly for interaction leaves Today calm: the only
  orange on the screen is what you can tap (the "Directions" stub button is
  deliberately secondary so the FAB stays the one filled control).
- `status-serious` was re-stepped (light `#A1401A` → `#7E3418`, dark
  `#F0875A` → `#FFB89A`): the round-1 dark value was ΔE 1.9 (OKLab ×100)
  from the dark accent, so a serious alert would have read as a button.
- The chart palette drops the reference orange for a plum so no data colour
  can be mistaken for the accent; blue is slot 1 so a single-series chart
  never reads as good or bad.
- Kiko stays out of data by construction: the mascot slot exists only in
  the Today header, empty states, loading and onboarding.
- Stamps get their own `stamp-ink` (a deep blue) so the reward never borrows
  the accent or a status colour.

## Open questions for the owner

- Is the darker rust / pale peach for `status-serious` acceptable, or should
  the status scale drop to three steps (good, warning, critical)?
- Should the ticket's "Directions" be a filled primary button? It is
  secondary now so the FAB stays the only filled control on Today.
- Plum (`series-4`) and violet (`series-7`) are in the chart palette; the
  anti-vibe rule bans purple as a UI colour, not as a data hue. Keep, or
  swap for bronze?
- Settled: the FAB covered the weather beside "Left today" when Today
  scrolls. `mk-page [fab]` now keeps `--fab-clearance` (the FAB's height
  plus 16 px) below the content on top of the tab bar's room, and the
  weather has its own full-width row below "Left today", so nothing sits
  beside the hero in the FAB's column.
- IBM Plex Mono ships 400/500 only in the repo; is 600 needed for anything?

## Mocks

Stitch mocks of the 13 MVP screens (Today, trip list and its empty state,
itinerary day, event detail, where we sleep, documents, budget, quick
expense, tasks, ready to fly, sign in, settings), light and dark, live in
[`mocks/`](mocks/) as `<screen>-{light,dark}.{html,png}`. They are a
reference only: `DESIGN.md` wins. Project and design-system ids, the prompt
per screen and the known deviations are in [`stitch.md`](stitch.md).
