import app from '@adonisjs/core/services/app'
import type { Group } from '@japa/runner/core'
import { Clock } from '#services/clock'

/** `Carbon::setTestNow`: a clock the test moves by hand. */
export class FixedClock extends Clock {
  constructor(public at: Date) {
    super()
  }

  now(): Date {
    return this.at
  }

  advance(ms: number): void {
    this.at = new Date(this.at.getTime() + ms)
  }
}

/** Swaps the clock for every test of the group, reset to `start` each time. */
export function useFixedClock(group: Group, start = new Date('2026-11-07T10:00:00Z')): FixedClock {
  const clock = new FixedClock(start)
  group.each.setup(() => {
    clock.at = new Date(start)
    app.container.swap(Clock, () => clock)
    return () => app.container.restore(Clock)
  })
  return clock
}
