/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| Every route has a name (`.as()`): the names are the Tuyau contract the web
| app is typed against (docs/CONTRACTS.md). After changing a route, run
| `npm run codegen` and commit `apps/api/.adonisjs`.
|
*/

import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router
  .group(() => {
    // Probes live outside /v1 on purpose: infrastructure depends on them.
    router.get('health', [controllers.HealthChecks, 'ready']).as('health.ready')
    router.get('health/live', [controllers.HealthChecks, 'live']).as('health.live')
  })
  .prefix('/api')

/**
 * SPA fallback. MUST stay the last route: anything that is neither an API
 * route nor a static file gets index.html. Excluded from the Tuyau registry.
 */
router.get('*', [controllers.Spa, 'show']).as('spa.fallback')
