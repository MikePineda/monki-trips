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

_Pending. The owner replies on the pull request with
`elijo: <direction> + <mascot>` or with changes for round 2; the result is
recorded here with the date._
