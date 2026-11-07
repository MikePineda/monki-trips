## Design round 1: pick a direction and a mascot

Everything renders offline (self-hosted fonts, zero network requests, checked by `scripts/design-shots.mjs`) and every palette passes `scripts/check-contrast.mjs` in light and dark (text 4.5:1, icons/borders/focus 3:1). Synthetic data only. Open the images on a phone; each one is a 390×844 screen.

### Contact sheet

![All renders](https://github.com/MikePineda/monki-trips/blob/design/round-1/docs/design/review/round-1/index.png?raw=true)

### Directions (the Today screen)

**A Notebook**: warm paper, ink and one ink-blue accent; Fraunces + Inter + IBM Plex Mono.
The next event is a taped note; hairlines everywhere else; stamps and tape stay off the data.

| light                                                                                                                            | dark                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ![A light](https://github.com/MikePineda/monki-trips/blob/design/round-1/docs/design/review/round-1/notebook-light.png?raw=true) | ![A dark](https://github.com/MikePineda/monki-trips/blob/design/round-1/docs/design/review/round-1/notebook-dark.png?raw=true) |

**B Boarding pass**: cool off-white, near-black ink, runway-orange accent; IBM Plex Sans + Mono for codes, times and PNRs.
The next event is a ticket with an SVG-mask perforation; departures-board labels in mono small caps.

| light                                                                                                                                 | dark                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| ![B light](https://github.com/MikePineda/monki-trips/blob/design/round-1/docs/design/review/round-1/boarding-pass-light.png?raw=true) | ![B dark](https://github.com/MikePineda/monki-trips/blob/design/round-1/docs/design/review/round-1/boarding-pass-dark.png?raw=true) |

**C Pixel**: clean neutral UI with a jungle-green accent, Atkinson Hyperlegible Next everywhere.
The only pixel art is the 16-colour sprite walking the day strip (and, later, the stamps).

| light                                                                                                                         | dark                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| ![C light](https://github.com/MikePineda/monki-trips/blob/design/round-1/docs/design/review/round-1/pixel-light.png?raw=true) | ![C dark](https://github.com/MikePineda/monki-trips/blob/design/round-1/docs/design/review/round-1/pixel-dark.png?raw=true) |

### Mascots (six states each, original SVG art)

**Kiko**: a travelling monkey with a huge backpack and a passport half out; curious and scatterbrained.
The third traveller who carries the paperwork; fits the "monki" family.

![Kiko](https://github.com/MikePineda/monki-trips/blob/design/round-1/docs/design/review/round-1/mascot-kiko.png?raw=true)

**Golo and Lina**: two swallows that always return to the same nest; navigator and keeper.
Every state shows on both birds, so it reads as "we".

![Golo and Lina](https://github.com/MikePineda/monki-trips/blob/design/round-1/docs/design/review/round-1/mascot-golo-lina.png?raw=true)

**Tag and Tug**: two luggage tags on one string; Tag the optimist, Tug the grump who counts documents.
The string is the trip; they cannot be separated.

![Tag and Tug](https://github.com/MikePineda/monki-trips/blob/design/round-1/docs/design/review/round-1/mascot-tag-tug.png?raw=true)

### Recommendation

**B Boarding pass + Kiko.** B gives the itinerary data (codes, times, booking references) the structure it needs and keeps one accent for interaction, so the Today screen stays calm; A's stamps can still be the reward on the trip list. Kiko is the most expressive at 48 px, animates well from a single body, and is the only concept that works both smooth and as a pixel sprite, so the choice of direction does not constrain the mascot.

### What is in the branch

- `docs/design/BRIEF.md` and `docs/design/DECISIONS.md` (D0).
- `docs/design/proposals/{notebook,boarding-pass,pixel}/today-{light,dark}.html` + `palette.md`, fonts under `docs/design/proposals/fonts/` (OFL).
- `docs/design/mascots/{kiko,golo-lina,tag-tug}/concept.svg` + `concept.md`.
- `scripts/design-shots.mjs`, `scripts/check-contrast.mjs` (+ spec), renders in `docs/design/review/round-1/`.

Reply with `elijo: <direction> + <mascot>` or with changes for round 2.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
