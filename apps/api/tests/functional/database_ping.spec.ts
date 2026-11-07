import { test } from '@japa/runner'
import { DatabasePing } from '#services/database_ping'

test.group('Database ping', () => {
  test('reports a reachable test database', async ({ assert }) => {
    assert.isTrue(await new DatabasePing().isReachable())
  })
})
