/**
 * Wire shapes of the operational probes. The API's health controller returns
 * these, so the typed client and these types never drift apart.
 */

export type HealthStatus = 'ok' | 'error'

/** Public probes expose statuses only; details go to the logs. */
export interface HealthCheckResult {
  status: HealthStatus
}

/** Body of `GET /api/health` (readiness probe): 200 when ok, 503 otherwise. */
export interface HealthReport {
  status: HealthStatus
  version: string
  sha: string
  checks: {
    db: HealthCheckResult
  }
}

/** Body of `GET /api/health/live` (liveness probe). */
export interface LivenessReport {
  status: 'ok'
}
