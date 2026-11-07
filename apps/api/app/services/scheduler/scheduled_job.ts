import type { JobInterval } from '#domain/scheduler_slot'

/**
 * A job the in-process scheduler runs once per slot of its interval, across
 * every replica. `name` is the advisory-lock key and the `scheduler_runs`
 * job name: keep it stable (`push:prune`, `reminders:leave-at`). `run`
 * does its own reads and writes; it never receives request context.
 */
export interface ScheduledJob {
  readonly name: string
  readonly interval: JobInterval
  run(now: Date): Promise<void>
}
