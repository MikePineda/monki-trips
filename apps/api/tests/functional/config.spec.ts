import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { VapidConfig } from '#services/vapid_config'
import { makeVapidConfig } from '#tests/helpers/fake_push'

test.group('Public config', () => {
  test('GET /config tells whether registration is open and which locales exist', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/api/v1/config')

    response.assertStatus(200)
    const { data } = response.body()
    assert.isTrue(data.registrationOpen)
    assert.deepEqual(data.locales, ['en', 'es'])
    assert.equal(data.defaultLocale, 'en')
    assert.isString(data.version)
  })

  test('GET /config exposes the vapid public key when push is enabled, never the private one', async ({
    client,
    assert,
  }) => {
    const vapid = makeVapidConfig()
    app.container.swap(VapidConfig, () => vapid)
    try {
      const response = await client.get('/api/v1/config')

      const { data } = response.body()
      assert.isTrue(data.pushEnabled)
      assert.match(data.vapidPublicKey, /^B[A-Za-z0-9_-]{86}$/)
      assert.equal(data.vapidPublicKey, vapid.publicKey)
      assert.notInclude(JSON.stringify(response.body()), vapid.details()!.privateKey)
    } finally {
      app.container.restore(VapidConfig)
    }
  })

  test('GET /config reports push disabled while the vapid variables are empty', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/api/v1/config')

    const { data } = response.body()
    assert.isFalse(data.pushEnabled)
    assert.isNull(data.vapidPublicKey)
  })

  test('GET /config hands out the CSRF cookie the first mutating request needs', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/api/v1/config')

    const cookies = (response.headers()['set-cookie'] as unknown as string[] | undefined) ?? []
    assert.isTrue(cookies.some((cookie: string) => cookie.startsWith('XSRF-TOKEN=')))
  })
})
