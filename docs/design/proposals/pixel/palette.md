# C · Pixel

A clean, very legible interface where the only "pixel" things are the
sprite mascot, the stamps and the pixel font inside them. Neutral surfaces,
one jungle-green accent for interaction, generous type. The sprite walks
along the day strip under the header, standing on today.

**Type:** Atkinson Hyperlegible Next 400/500/600 for everything (tabular
figures on numbers and times); Silkscreen 400 (`@fontsource/silkscreen`,
not shipped in this round) only inside stamps. Radii 4/8/12, sheets 16.

## Tokens

| Token              | Light   | Dark    | Role       | Against                         |
| ------------------ | ------- | ------- | ---------- | ------------------------------- |
| surface-0          | #FAFAF7 | #141418 | surface    |                                 |
| surface-1          | #FFFFFF | #1C1C22 | surface    |                                 |
| surface-2          | #EFEFEA | #26262D | surface    |                                 |
| ink-1              | #16161A | #ECECEA | text       | surface-0, surface-1, surface-2 |
| ink-2              | #4B4B55 | #B3B3B8 | text       | surface-0, surface-1, surface-2 |
| ink-3              | #62626D | #90909A | text       | surface-0, surface-1, surface-2 |
| line               | #DCDCD6 | #2E2E36 | decorative |                                 |
| line-strong        | #85858F | #6C6C75 | graphic    | surface-0, surface-1            |
| icon               | #4B4B55 | #B3B3B8 | graphic    | surface-0, surface-1, surface-2 |
| accent             | #1E6B47 | #6FC79A | text       | surface-0, surface-1, surface-2 |
| focus              | #1E6B47 | #6FC79A | graphic    | surface-0, surface-1, surface-2 |
| on-accent          | #FAFAF7 | #141418 | text       | accent                          |
| status-good        | #2A6B3C | #7CC58B | text       | surface-0, surface-1            |
| status-warning     | #835700 | #E2AA3A | text       | surface-0, surface-1            |
| status-serious     | #A1401A | #F0875A | text       | surface-0, surface-1            |
| status-critical    | #A01C1C | #F07070 | text       | surface-0, surface-1            |
| print-warning      | #F4E4B0 | #4A3A10 | surface    |                                 |
| on-print-warning   | #16161A | #ECECEA | text       | print-warning                   |
| on-print-warning-2 | #4B4B55 | #B3B3B8 | text       | print-warning                   |

Roles: `text` ≥ 4.5:1, `graphic` ≥ 3:1 (icons, meaningful borders, focus
rings), `surface` and `decorative` unchecked. `line` is the hairline between
rows, decorative by design; `line-strong` draws inputs, chips and the day
strip ticks.

## Sprite palette (mascot and stamps only)

Sixteen colours, fixed in both themes, `image-rendering: pixelated`. They
never appear in the UI, which is why they are not in the token table.

| Index | Hex     | Use                      |
| ----- | ------- | ------------------------ |
| 0     | #16161A | outline                  |
| 1     | #FAFAF7 | highlight, eye white     |
| 2     | #8B5A2B | fur                      |
| 3     | #5C3A1A | fur shadow               |
| 4     | #E8C39E | face, hands              |
| 5     | #C99A72 | face shadow              |
| 6     | #4E7A3B | backpack                 |
| 7     | #2F5126 | backpack shadow          |
| 8     | #22508F | passport                 |
| 9     | #8FB0E0 | passport highlight       |
| 10    | #B5470C | tag, scarf               |
| 11    | #E0A93A | buckle, sun              |
| 12    | #9B1C1C | tongue, warning          |
| 13    | #7FC08A | leaf, go                 |
| 14    | #6A6A75 | grey (zzz, string)       |
| 15    | #B3B3B8 | light grey (cloud, tape) |

## Signature elements

- **Day strip**: 12 ticks under the header, past days filled `ink-3`, today
  `accent`, the sprite stands on today and walks one tick per day.
- **Stamps**: pixel art in the 16-colour palette, Silkscreen for the text;
  trip list and empty states only.
- Mascot: Kiko as a 16×16 sprite scaled 3×; the other two concepts work the
  same way.
