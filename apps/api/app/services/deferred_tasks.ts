import type { Logger } from '@adonisjs/core/logger'

/**
 * Work a request starts but does not wait for, such as a mail whose
 * delivery time would otherwise tell an observer something (an address
 * exists). Each task starts after the current tick, its failure is logged
 * (never thrown at the caller) and the process waits for open tasks on
 * shutdown. One instance per process (`providers/deferred_tasks_provider.ts`).
 */
export class DeferredTasks {
  readonly #pending = new Set<Promise<void>>()

  constructor(private readonly logger: Logger) {}

  /** Runs `task` soon, outside the caller's await. `label` names it in the log; keep personal data out of it. */
  defer(label: string, task: () => Promise<void>): void {
    const run = new Promise<void>((resolve) => setImmediate(resolve))
      .then(task)
      .catch((error: unknown) => {
        this.logger.error({ err: error, task: label }, 'deferred task failed')
      })
      .finally(() => {
        this.#pending.delete(run)
      })
    this.#pending.add(run)
  }

  /** Resolves once every task deferred so far, and any they defer, has finished. */
  async settled(): Promise<void> {
    while (this.#pending.size > 0) {
      await Promise.allSettled([...this.#pending])
    }
  }
}
