import type { Logger } from '@adonisjs/core/logger'
import type { ScheduledJob } from '#services/scheduler/scheduled_job'

/**
 * The first registered job, a documented stub: once a day it will remove
 * push subscriptions that keep failing (`failures` above a threshold, no
 * `last_used_at` for weeks). Today it reads and writes nothing, so the
 * scheduler path (lock, `scheduler_runs`, logging) runs in production
 * before the reminders of WP 2.7b depend on it. Endpoints a push service
 * reports gone are already deleted at send time (`PushNotifications`).
 */
export class PushPruneJob implements ScheduledJob {
  readonly name = 'push:prune'
  readonly interval = 'day' as const

  constructor(private readonly logger: Logger) {}

  async run(): Promise<void> {
    this.logger.info({ job: this.name }, 'push:prune is a no-op until WP 2.7b')
  }
}
