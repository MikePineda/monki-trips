import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { DatabasePing } from '#services/database_ping'

class UnreachableDatabase extends DatabasePing {
  override async isReachable() {
    return false
  }
}

test.group('Health probes', () => {
  test('readiness reports ok with version, sha and the db check', async ({ client, assert }) => {
    const response = await client.get('/api/health')

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.status, 'ok')
    assert.isString(body.version)
    assert.isString(body.sha)
    assert.deepEqual(body.checks, { db: { status: 'ok' } })
  })

  test('readiness answers 503 when the database ping fails', async ({ client, assert }) => {
    app.container.swap(DatabasePing, () => new UnreachableDatabase())
    try {
      const response = await client.get('/api/health')

      response.assertStatus(503)
      assert.equal(response.body().status, 'error')
      assert.deepEqual(response.body().checks, { db: { status: 'error' } })
    } finally {
      app.container.restore(DatabasePing)
    }
  })

  test('readiness never leaks connection details', async ({ client, assert }) => {
    const response = await client.get('/api/health')

    assert.sameMembers(Object.keys(response.body()), ['status', 'version', 'sha', 'checks'])
  })

  test('liveness answers without touching dependencies', async ({ client }) => {
    app.container.swap(DatabasePing, () => new UnreachableDatabase())
    try {
      const response = await client.get('/api/health/live')

      response.assertStatus(200)
      response.assertBody({ status: 'ok' })
    } finally {
      app.container.restore(DatabasePing)
    }
  })
})
