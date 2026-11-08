import type { ApplicationService } from '@adonisjs/core/types'
import { shouldStartScheduler } from '#domain/scheduler_slot'
import { Clock } from '#services/clock'
import { JobClaim } from '#services/scheduler/job_claim'
import { PushPruneJob } from '#services/scheduler/push_prune_job'
import { PushRemindersJob } from '#services/scheduler/push_reminders_job'
import { Scheduler } from '#services/scheduler/scheduler'

/**
 * One `Scheduler` per process with the registered jobs. It ticks only in
 * the HTTP server and only unless `SCHEDULER=off`; shutdown waits for a
 * tick in flight. Specs make the singleton and drive `runDue()` by hand.
 */
export default class SchedulerProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(Scheduler, async () => {
      const logger = await this.app.container.make('logger')
      const scheduler = new Scheduler(new JobClaim(), await this.app.container.make(Clock), logger)
      scheduler.register(new PushPruneJob(logger))
      scheduler.register(await this.app.container.make(PushRemindersJob))
      return scheduler
    })
  }

  async ready() {
    const { default: env } = await import('#start/env')
    const start = shouldStartScheduler({
      scheduler: env.get('SCHEDULER'),
      environment: this.app.getEnvironment(),
    })
    if (!start) return
    const scheduler = await this.app.container.make(Scheduler)
    scheduler.start()
    const logger = await this.app.container.make('logger')
    logger.info({ jobs: scheduler.jobNames }, 'scheduler started')
  }

  async shutdown() {
    if (!this.app.container.hasBinding(Scheduler)) return
    const scheduler = await this.app.container.make(Scheduler)
    await scheduler.stop()
  }
}
