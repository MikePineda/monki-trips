# Tag and Tug

Two luggage tags tied by the same string: a kraft-paper tag with a rust
band (Tag) and a classic clipped-corner tag in pale blue (Tug).

## Personality

- Tag is the optimist: everything is fine as long as the string holds.
- Tug is the grump: he counts documents and frowns when one is missing.
- They cannot be separated, which is the whole point.

## Why it fits two people travelling together

The string is the trip: two tags on it move together, swing together and
end up at the same carousel. Tags are literally about luggage, documents
and bookings, so the mascot sits naturally next to the vault and the
"print this" banner. Tug's frown is the honest version of a warning icon.

## States and how they read

| State         | Pose                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- |
| `happy`       | Hanging side by side from one knot, both smiling.                                      |
| `worried`     | Tag anxious with a sweat drop, Tug frowning, a dashed outline of the missing document. |
| `excited`     | Both bounced upwards, string taut, mouths open, motion lines.                          |
| `asleep`      | Leaning on each other, string slack, eyes closed, three "z".                           |
| `celebrating` | The string tied in a bow, eyes closed with joy, confetti.                              |
| `thinking`    | Tag ponders with a thought bubble, Tug squints.                                        |

## How it would animate

Sprite sheet of 64×64 frames, `render: smooth`. The string is the
animation: `happy` swings two frames left and right; `worried` has Tug
shaking his band; `excited` bounces with the string snapping taut;
`asleep` sways slowly with the slack string; `celebrating` pulls the bow
tight in three frames; `thinking` cycles the dots. `still` is the first
frame; reduced motion shows it only.

## Licence

Original artwork, AGPL-3.0-only.
