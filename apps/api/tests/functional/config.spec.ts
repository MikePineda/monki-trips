import { test } from '@japa/runner'

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

  test('GET /config hands out the CSRF cookie the first mutating request needs', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/api/v1/config')

    const cookies = (response.headers()['set-cookie'] as unknown as string[] | undefined) ?? []
    assert.isTrue(cookies.some((cookie: string) => cookie.startsWith('XSRF-TOKEN=')))
  })
})
