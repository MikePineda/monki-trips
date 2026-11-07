import app from '@adonisjs/core/services/app'
import { DeferredTasks } from '#services/deferred_tasks'

/** Waits for every task deferred past a response (mails, mostly) to finish. */
export async function settleDeferred(): Promise<void> {
  const tasks = await app.container.make(DeferredTasks)
  await tasks.settled()
}
