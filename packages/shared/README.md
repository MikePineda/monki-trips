# @monkitrips/shared

Wire types and pure domain helpers shared by the API (`apps/api`) and the
web app (`apps/web`). Compiled to `dist/` because Node does not load `.ts`
from `node_modules`; tested with `node:test` (`npm test -w @monkitrips/shared`).

- `src/*.ts`: the shapes the API returns and accepts (`Trip`, `UserProfile`,
  `ERROR_CODES`, API paths, locales...).
- `src/domain/*.ts`: every business rule both sides need, computed once and
  the same offline: nights, budget, Today, tasks, mascot, FX, sync merge,
  offline readiness.

## The domain is pure

No I/O, no framework, no ORM, no zone database and no implicit clock: `now`
and `today` are always parameters. Each file holds one concept, named after
it, with its input and output types next to the function and a test file
whose names read like the spec.

| Module                                                                      | Answers                                                                                      |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `convert_to_base.ts`                                                        | minor units of one currency → minor units of the base, half-even, from a decimal rate string |
| `night_coverage.ts`                                                         | which nights have a bed (lodging, overnight transport, override) and which raise an alert    |
| `budget_status.ts`                                                          | remaining, allowance for today, left today, pending FX, committed costs                      |
| `print_tasks.ts`                                                            | the one task a `print` document owns, and when it goes away                                  |
| `today_view.ts`                                                             | the Today screen: zone, day N of M, next event with "leave at", documents, tonight, budget   |
| `leave_at.ts`                                                               | the per-kind buffer (flight 150, train 30, ferry 45, bus 20, rest 15) and the travel time    |
| `task_urgency.ts`                                                           | overdue / today / this_week / later / no_date                                                |
| `mascot_state.ts`                                                           | celebrating > asleep > worried > excited > happy                                             |
| `trip_summary.ts`                                                           | state, days, nights, countries                                                               |
| `route_chips.ts`                                                            | `ORG → MID → DST` with consecutive repeats collapsed                                         |
| `lww_merge.ts`                                                              | field-level last-write-wins with tombstones and a clamped `changedAt`                        |
| `offline_readiness.ts`                                                      | the seven "Ready to fly" checks                                                              |
| `trip_dates.ts`                                                             | the calendar window of a trip and its derived state                                          |
| `iso_date.ts`, `zoned_instant.ts`, `minor_units.ts`, `currency_exponent.ts` | the primitives below                                                                         |

## Input contract

**Dates** are `YYYY-MM-DD` strings (`IsoDate`). Arithmetic is whole days;
there is no zone in a date.

**Instants** are ISO 8601 strings with a zone designator, normally UTC
(`IsoInstant`, e.g. `2026-01-20T15:30:00Z`). Wherever the domain needs the
local wall clock it takes a `ZonedInstant`: the instant **plus
`offsetMin`**, the UTC offset (minutes east of UTC) that the IANA zone had
at that instant, resolved by the caller (Luxon on the API, `Intl` on the
web). The zone name travels along for display only. This is how the package
stays free of a time-zone database and how DST is settled:

- a wall clock inside a DST gap does not exist, so it never reaches the
  domain (the API answers 422 before);
- an ambiguous wall clock (DST overlap) is two different instants told apart
  by the two offsets the caller can pass;
- a segment that departs in one zone and lands in another carries one offset
  per end; night coverage reads its window in the departure zone;
- stops and the trip's home zone carry `offsetMin` **at `now`** when a
  pipeline must locate `now` (Today, mascot).

**Money** is integer minor units named `*Minor`. The domain computes in
`bigint` and returns `bigint`. Inputs accept `bigint`, an integer string
(what JSON carries) or a safe-integer `number` (`MinorUnits`); anything
fractional throws. FX rates are decimal **strings** (`"23.1234567891"`, units
of the original currency per 1 unit of the base) and are parsed exactly.
Exponents come from the ISO 4217 table in `currency_exponent.ts`.

**Events** come with their instants already resolved (`starts`, `ends`,
segment `departs`/`arrives` as `ZonedInstant`). An event without an end has
no duration. `cancelled` and `idea` events are not part of the plan.

**Errors**: malformed input (an impossible date, a fractional amount, a rate
of zero) throws `RangeError`. The pipelines never catch; the caller validates
before and decides after.
