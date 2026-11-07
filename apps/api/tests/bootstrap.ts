import { assert } from '@japa/assert'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { dbAssertions } from '@adonisjs/lucid/plugins/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { apiClient } from '@japa/api-client'
import { shieldApiClient } from '@adonisjs/shield/plugins/api_client'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'
import { authApiClient } from '@adonisjs/auth/plugins/api_client'

/**
 * Imported by the "bin/test.ts" entrypoint.
 *
 * `sessionApiClient` + `shieldApiClient` give `withSession()` and
 * `withCsrfToken()`; `dbAssertions` gives `db.assertHas(...)`;
 * `authApiClient` gives `loginAs(user)`. Prefer `actingAs(request, user)`
 * from tests/helpers/acting_as.ts: it also stamps the session version the
 * auth middleware checks.
 */
export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),
  dbAssertions(app),
  apiClient(),
  sessionApiClient(app),
  shieldApiClient(),
  authApiClient(app),
]

/**
 * Runner-wide hooks. Kept empty so the unit suite never needs a database.
 */
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [],
  teardown: [],
}

/**
 * Laravel's `RefreshDatabase` for the functional suite: migrate the test
 * database once per suite (rolled back at the end) and wrap every test in a
 * global transaction that is rolled back after it. Every functional test
 * lives inside a `test.group` so the hook reaches it.
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (suite.name === 'functional') {
    suite.setup(() => testUtils.db().migrate())
    suite.onGroup((group) => {
      group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
    })
    return suite.setup(() => testUtils.httpServer().start())
  }
}
