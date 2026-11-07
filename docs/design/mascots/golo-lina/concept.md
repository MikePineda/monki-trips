# Golo and Lina

A pair of swallows. Swallows migrate thousands of kilometres and come back
to the same nest every year; these two do the same with every trip.

## Personality

- Golo is the navigator: looks ahead, counts the days, keeps the route.
- Lina is the keeper: knows where everything is and when the nest is ready.
- Together they are quiet and quick; they never fuss, they just leave on time.

## Why it fits two people travelling together

Two birds, one nest, one string of journeys: the pair is the trip's unit,
not a single traveller. The nest is home base (the base currency, the
return flight); the wire they perch on is the itinerary. Their states show
on both birds at once, which reads as "we" rather than "you".

## States and how they read

| State         | Pose                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `happy`       | Perched together on the wire, leaning in.                                                              |
| `worried`     | Apart on the wire, ruffled crown, a sweat drop, a dashed outline of the missing document between them. |
| `excited`     | Both in the air, wings wide, motion lines.                                                             |
| `asleep`      | Tucked together in the nest, eyes closed, three "z".                                                   |
| `celebrating` | A dotted loop around the nest, confetti.                                                               |
| `thinking`    | One head tilted, thought bubble with three dots.                                                       |

## How it would animate

Sprite sheet of 64×64 frames, `render: smooth`, both birds in every frame.
`happy` is a slow two-frame breathe plus a blink; `worried` ruffles and
looks left and right; `excited` is a four-frame wing beat; `asleep` rises
and falls with the nest; `celebrating` flies the loop in six frames;
`thinking` tilts the head and cycles the dots. `still` is the perched frame.
Reduced motion shows the still frame only.

## Licence

Original artwork, AGPL-3.0-only.
