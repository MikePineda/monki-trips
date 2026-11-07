# B · Boarding pass

The calm of an airport departures board: cool off-white, near-black ink and
one runway-orange accent reserved for interaction. Codes, times and booking
references are set in mono so they line up like a ticket. The next event is
a ticket card whose perforation is an SVG mask (two half-circle notches and
a dashed hairline), with no gradient or shadow.

**Type:** IBM Plex Sans 400/500/600 (text), IBM Plex Mono 400/500 (IATA
codes, times, countdowns, PNRs). Tabular figures everywhere. Radii 4/8/12,
sheets 16.

## Tokens

| Token              | Light   | Dark    | Role       | Against                         |
| ------------------ | ------- | ------- | ---------- | ------------------------------- |
| surface-0          | #F5F5F2 | #0F1113 | surface    |                                 |
| surface-1          | #FBFBF9 | #17191C | surface    |                                 |
| surface-2          | #ECECE8 | #202326 | surface    |                                 |
| ink-1              | #111417 | #ECEDEE | text       | surface-0, surface-1, surface-2 |
| ink-2              | #4A5058 | #B4B9BF | text       | surface-0, surface-1, surface-2 |
| ink-3              | #626971 | #8A9097 | text       | surface-0, surface-1, surface-2 |
| line               | #D7D8D3 | #2C3035 | decorative |                                 |
| line-strong        | #80868E | #6A7079 | graphic    | surface-0, surface-1            |
| icon               | #4A5058 | #B4B9BF | graphic    | surface-0, surface-1, surface-2 |
| accent             | #B5470C | #F08A4B | text       | surface-0, surface-1, surface-2 |
| focus              | #B5470C | #F08A4B | graphic    | surface-0, surface-1, surface-2 |
| on-accent          | #F5F5F2 | #0F1113 | text       | accent                          |
| status-good        | #2E6B3F | #7CC58B | text       | surface-0, surface-1            |
| status-warning     | #845600 | #E2AA3A | text       | surface-0, surface-1            |
| status-serious     | #A1401A | #F0875A | text       | surface-0, surface-1            |
| status-critical    | #A01C1C | #F07070 | text       | surface-0, surface-1            |
| print-warning      | #F4E2AE | #4D3410 | surface    |                                 |
| on-print-warning   | #111417 | #ECEDEE | text       | print-warning                   |
| on-print-warning-2 | #4A5058 | #B4B9BF | text       | print-warning                   |

Roles: `text` ≥ 4.5:1, `graphic` ≥ 3:1 (icons, meaningful borders, focus
rings), `surface` and `decorative` unchecked. `line` is the hairline between
rows and the perforation dashes, decorative by design; `line-strong` draws
inputs, chips and the ticket edge.

## Signature elements

- **Ticket card**: `surface-1` with a `line-strong` hairline edge; the
  stub holds the route in large mono (`PVM → ALD`) and the perforation is a
  `<mask>` that cuts two notches out of the card.
- **Departures-board rows**: label in small caps, value in mono, hairline
  between rows.
- **Stamps** are the reward (direction A's stamps can be borrowed here):
  trip list and empty states only.
- Mascot: any of the three concepts, smooth rendering, 48 px in the header.
