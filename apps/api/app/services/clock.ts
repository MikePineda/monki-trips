/**
 * The source of "now" for request handlers. Domain code takes `now` as a
 * parameter; services get it from here, and tests swap the class in the
 * container (`app.container.swap(Clock, () => new FixedClock(...))`), the
 * equivalent of Laravel's `Carbon::setTestNow`.
 */
export class Clock {
  now(): Date {
    return new Date()
  }
}
