import type { Logger } from '@adonisjs/core/logger'
import { slotKey } from '#domain/scheduler_slot'
import type { Clock } from '#services/clock'
import type { JobClaim } from '#services/scheduler/job_claim'
import type { ScheduledJob } from '#services/scheduler/scheduled_job'

/** How often a worker looks for due slots. */
export const TICK_MS = 60_000

/**
 * The in-process scheduler: every replica of the API runs one, ticking once
 * a minute. On each tick every registered job is offered its current slot;
 * `JobClaim` decides (once across all replicas) whether this worker runs
 * it. A job's own error is logged and recorded as `failed`; the next slot
 * runs regardless. `start()` is called by the provider for the HTTP server
 * only (`SCHEDULER=off` keeps it idle); `runDue()` is what a spec drives.
 */
export class Scheduler {
  readonly #jobs = new Map<string, ScheduledJob>()
  #timer: NodeJS.Timeout | null = null
  #ticking: Promise<void> | null = null

  constructor(
    private readonly claims: JobClaim,
    private readonly clock: Clock,
    private readonly logger: Logger
  ) {}

  /** Registers a job; a second job with the same name is a programming error. */
  register(job: ScheduledJob): void {
    if (this.#jobs.has(job.name)) {
      throw new Error(`scheduler: job "${job.name}" is already registered`)
    }
    this.#jobs.set(job.name, job)
  }

  get jobNames(): string[] {
    return [...this.#jobs.keys()]
  }

  /** Offers every job its slot at `now` and runs the ones this worker wins. */
  async runDue(now: Date = this.clock.now()): Promise<void> {
    for (const job of this.#jobs.values()) {
      await this.runJob(job, now)
    }
  }

  /** One job, one slot: claim, run, record. Resolves to whether this worker ran it. */
  async runJob(job: ScheduledJob, now: Date): Promise<boolean> {
    const run = await this.claims.claim(job.name, slotKey(job.interval, now))
    if (!run) return false
    try {
      await job.run(now)
      await this.claims.finish(run, 'done', this.clock.now())
    } catch (error) {
      this.logger.error({ err: error, job: job.name, runKey: run.runKey }, 'scheduled job failed')
      await this.claims.finish(run, 'failed', this.clock.now())
    }
    return true
  }

  /** Ticks now and then every `TICK_MS`; a tick still running skips the next one. */
  start(tickMs = TICK_MS): void {
    if (this.#timer) return
    const tick = () => {
      if (this.#ticking) return
      this.#ticking = this.runDue()
        .catch((error: unknown) => {
          this.logger.error({ err: error }, 'scheduler tick failed')
        })
        .finally(() => {
          this.#ticking = null
        })
    }
    this.#timer = setInterval(tick, tickMs)
    this.#timer.unref()
    tick()
  }

  /** Stops ticking and waits for a tick in flight. */
  async stop(): Promise<void> {
    if (this.#timer) {
      clearInterval(this.#timer)
      this.#timer = null
    }
    await this.#ticking
  }

  get running(): boolean {
    return this.#timer !== null
  }
}
