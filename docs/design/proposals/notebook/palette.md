# A · Notebook

A travel notebook: warm paper, one ink, one ink-blue accent for everything
you can tap. Hairlines separate; nothing is boxed. The next event sits on a
"taped note", the one place the paper texture shows (a flat tape rectangle,
no gradient, no shadow). Washi tape and passport stamps appear only on the
mascot, the stamps and the empty states, never on data.

**Type:** Fraunces 400/600 (display: day header, hero number, event title),
Inter 400/500/600 (text), IBM Plex Mono 400/500 (codes, times, countdowns).
Tabular figures everywhere a number can change. Radii 4/8/12, sheets 16.

## Tokens

| Token              | Light   | Dark    | Role       | Against                         |
| ------------------ | ------- | ------- | ---------- | ------------------------------- |
| surface-0          | #F2EDE3 | #1A1815 | surface    |                                 |
| surface-1          | #F8F4EC | #24211D | surface    |                                 |
| surface-2          | #E9E2D4 | #2E2A25 | surface    |                                 |
| ink-1              | #29241F | #EDE6D8 | text       | surface-0, surface-1, surface-2 |
| ink-2              | #5B5247 | #BFB5A6 | text       | surface-0, surface-1, surface-2 |
| ink-3              | #6E6356 | #9A9082 | text       | surface-0, surface-1, surface-2 |
| line               | #D9D1C2 | #3A352E | decorative |                                 |
| line-strong        | #857A6B | #756C60 | graphic    | surface-0, surface-1            |
| icon               | #5B5247 | #BFB5A6 | graphic    | surface-0, surface-1, surface-2 |
| accent             | #22508F | #8FB0E0 | text       | surface-0, surface-1, surface-2 |
| focus              | #22508F | #8FB0E0 | graphic    | surface-0, surface-1, surface-2 |
| on-accent          | #F2EDE3 | #1A1815 | text       | accent                          |
| status-good        | #2F6B3A | #7FC08A | text       | surface-0, surface-1            |
| status-warning     | #8A5A00 | #E0A93A | text       | surface-0, surface-1            |
| status-serious     | #A3431A | #F0875A | text       | surface-0, surface-1            |
| status-critical    | #9B1C1C | #F07070 | text       | surface-0, surface-1            |
| print-warning      | #F3DFA6 | #4A3A10 | surface    |                                 |
| on-print-warning   | #29241F | #EDE6D8 | text       | print-warning                   |
| on-print-warning-2 | #5B5247 | #BFB5A6 | text       | print-warning                   |

Roles: `text` ≥ 4.5:1, `graphic` ≥ 3:1 (icons, meaningful borders, focus
rings), `surface` and `decorative` unchecked. `line` is the hairline between
rows and is decorative by design: it never carries meaning alone, and
anything that needs a visible boundary (inputs, chips, the tape edge) uses
`line-strong`.

## Signature elements

- **Taped note** for the next event: `surface-1` sheet, hairline edge, one
  flat `surface-2` tape strip rotated −2°. The only rotation on the screen.
- **Route chip** in IBM Plex Mono: `PVM → ALD`, hairline border.
- **Stamps** (round or rounded-square, two inks) show on the trip list and
  in empty states only; none on Today.
- Mascot: any of the three concepts, smooth rendering, 48 px in the header.
