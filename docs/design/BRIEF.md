# Design brief (D0)

The prompt below is the design brief for monki-trips. It is the text given to
any design tool or agent that produces screens, and the yardstick for the
design review (`.claude/skills/web-design-guidelines/SKILL.md`). The three
placeholders are filled in by the owner's round-1 decision
(`docs/design/DECISIONS.md`): `<chosen direction>`, `<families>` and
`<name>`.

```text
Design a mobile-first PWA (390x844, iOS safe areas, bottom tab bar) for people travelling together
(a home base currency, trips in other currencies). Feel: <chosen direction>, a trusted travel companion
that is calm under pressure; not a booking site, not a generic AI-generated app. Light AND dark, semantic
tokens: surface-0/1/2, ink-1/2/3, line, line-strong, accent (ONE hue, interaction only: links, focus,
selection; never a fill on data), status good/warning/serious/critical (always icon + label), print-warning.
Typography: <families>, self-hosted, weights 400/500/600; tabular figures for every number, times,
countdowns, codes in mono. Hairlines instead of boxes; no cards in cards; radii 4/8/12, sheets 16.
ANTI-VIBE: no gradients, no glass/blur, no default purple, no emoji as icons, one icon set (Lucide 1.75px),
motion 150-200ms ease-out only for sheets/toasts, reduced-motion respected, honest empty states with one
action, no donut/pie/dual-axis charts, a table view for every chart. The mascot <name> (original character)
appears only in empty states, loading and Today, never as decoration on data.
TODAY, top to bottom: day N of M + city + connection status + small mascot; next event with local time,
countdown, "leave at", route chip (ORG -> DST), Directions; documents needed today with a full-width
"print this" warning; tonight's stay with large copyable address and local-script address; budget left
today (local currency hero, base currency below); weather (cached, with age); floating quick-expense button.
Also: trip list, itinerary day, event detail, where we sleep, documents, quick expense sheet (3 taps),
budget with table view, offline-ready checklist, empty states. Copy bilingual en-AU / es-MX, no names
assumed ("you" and "{partner}"), true minus sign U+2212.
```

## How the brief is used

- **Round 1 (D1)** renders the Today screen in three directions and draws
  three mascot concepts; the owner picks one of each from the PNGs in the PR
  (`docs/design/review/round-1/`).
- **Round 2 (D2)** turns the chosen pair into `docs/design/DESIGN.md`, the
  tokens in `apps/web/src/styles.css`, the ui-kit and the public
  `/styleguide` route. No feature work package starts before the owner
  labels that PR `design-approved`.
- Every proposal is self-contained HTML/SVG with self-hosted fonts and makes
  no network request; `scripts/design-shots.mjs` fails on any request that is
  not `file://`.
- Palettes pass `scripts/check-contrast.mjs` in both themes: text 4.5:1,
  icons, meaningful borders and focus rings 3:1.
- Content in proposals is synthetic: invented places, codes and prices.
