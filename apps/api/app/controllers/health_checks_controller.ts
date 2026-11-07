import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { HealthReport, LivenessReport } from '@monkitrips/shared'
import { currentBuildInfo } from '#services/build_info'
import { DatabasePing } from '#services/database_ping'

/**
 * Probes for the container healthcheck, uptime monitors and the post-deploy
 * smoke test. Public on purpose, so they expose statuses only: no messages,
 * hosts or process details (those go to the logs).
 */
@inject()
export default class HealthChecksController {
  constructor(private readonly database: DatabasePing) {}

  /**
   * Readiness: 200 when Postgres answers, 503 otherwise.
   */
  async ready({ response, logger }: HttpContext): Promise<HealthReport> {
    const [dbReachable, build] = await Promise.all([
      this.database.isReachable(),
      currentBuildInfo(),
    ])

    if (!dbReachable) {
      logger.error('readiness probe failed: database unreachable')
      response.status(503)
    }

    const status = dbReachable ? 'ok' : 'error'
    return { status, version: build.version, sha: build.sha, checks: { db: { status } } }
  }

  /**
   * Liveness: the process is up and serving requests. Touches nothing else.
   */
  async live(): Promise<LivenessReport> {
    return { status: 'ok' }
  }
}
