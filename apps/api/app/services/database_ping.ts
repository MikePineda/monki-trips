import db from '@adonisjs/lucid/services/db'

/**
 * Answers "can the app talk to Postgres right now?" for the readiness probe.
 * A class (not a function) so tests can swap it in the container to simulate
 * an outage.
 */
export class DatabasePing {
  /** Resolves true when `select 1` succeeds within the timeout, false otherwise. Never throws. */
  async isReachable(timeoutMs = 2000): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs)
    })
    try {
      return await Promise.race([
        db
          .rawQuery('select 1')
          .then(() => true)
          .catch(() => false),
        timeout,
      ])
    } finally {
      clearTimeout(timer)
    }
  }
}
