import type { ApplicationService } from '@adonisjs/core/types'
import { DeferredTasks } from '#services/deferred_tasks'

/** One `DeferredTasks` per process, drained before the process exits. */
export default class DeferredTasksProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(DeferredTasks, async () => {
      return new DeferredTasks(await this.app.container.make('logger'))
    })
  }

  async shutdown() {
    const tasks = await this.app.container.make(DeferredTasks)
    await tasks.settled()
  }
}
