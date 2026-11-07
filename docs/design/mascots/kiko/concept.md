# Kiko

A travelling monkey with a backpack bigger than he is and a passport that
never quite fits in the pocket. The "monki" of monki-trips.

## Personality

- Curious: everything is the best thing he has ever seen, especially trains.
- Scatterbrained: he always has the passport, just never where he left it.
- Loyal: he waits at the platform until everyone is there.

## Why it fits two people travelling together

Kiko is the third traveller, the one who carries the paperwork and worries
about it so the two of you do not have to. His backpack is the document
vault; the passport sticking out is the reminder "did we print it?". He
never comments on money or on anyone, only on the trip.

## States and how they read

| State         | Pose                                                            |
| ------------- | --------------------------------------------------------------- |
| `happy`       | Arms down, round eyes, soft smile.                              |
| `worried`     | Scratching his head, slanted brows, wavy mouth, one sweat drop. |
| `excited`     | Both arms up, wide eyes, open mouth, motion lines.              |
| `asleep`      | Leaning on the backpack, eyes closed, three "z".                |
| `celebrating` | Arms up with a small pennant, eyes closed with joy, confetti.   |
| `thinking`    | Hand on chin, one brow raised, thought bubble with three dots.  |

## How it would animate

Sprite sheet of 64×64 frames, `render: smooth`. Each state loops at 4 to
6 fps on two to four frames: `happy` blinks and sways the tail; `worried`
scratches; `excited` bounces (the backpack lags one frame behind);
`asleep` breathes with the backpack rising; `celebrating` waves the pennant;
`thinking` cycles the three dots. `still` is the first frame, used under
`prefers-reduced-motion`. Walk cycle (optional, for direction C's day
strip): four frames, tail counter-swinging.

## Licence

Original artwork, AGPL-3.0-only.
