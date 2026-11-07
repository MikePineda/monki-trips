import { test } from '@japa/runner'
import limiter from '@adonisjs/limiter/services/main'
import User from '#models/user'
import { actingAs } from '#tests/helpers/acting_as'
import { expectStatus } from '#tests/helpers/expect_status'
import { makeUser, TEST_PASSWORD } from '#tests/helpers/make_user'
import env from '#start/env'

/** Sets TRUSTED_PROXY for the current test; the group restores it afterwards. */
function useTrustedProxy(value: 'none' | 'cloudflare') {
  env.set('TRUSTED_PROXY', value)
}

test.group('Login and session', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.setup(() => {
    const before = env.get('TRUSTED_PROXY')
    return () => env.set('TRUSTED_PROXY', before ?? 'none')
  })

  test('a right password opens a session that answers /auth/me', async ({ client, assert }) => {
    const user = await makeUser({ email: 'owner@example.com' })

    const login = await client
      .post('/api/v1/auth/login')
      .withCsrfToken()
      .json({ email: 'Owner@Example.com', password: TEST_PASSWORD })

    login.assertStatus(200)
    assert.equal(login.body().data.email, 'owner@example.com')
    assert.notProperty(login.body().data, 'password')
    await user.refresh()
    assert.isNotNull(user.lastLoginAt)

    const me = await client.get('/api/v1/auth/me').withSession(login.session())
    me.assertStatus(200)
    assert.equal(me.body().data.id, user.id)
  })

  test('a wrong password answers 401 without saying which part was wrong', async ({ client }) => {
    await makeUser({ email: 'owner@example.com' })

    const response = await client
      .post('/api/v1/auth/login')
      .withCsrfToken()
      .json({ email: 'owner@example.com', password: 'not-the-password' })

    response.assertStatus(401)
    response.assertBodyContains({ code: 'E_INVALID_CREDENTIALS' })

    const unknown = await client
      .post('/api/v1/auth/login')
      .withCsrfToken()
      .json({ email: 'nobody@example.com', password: 'not-the-password' })
    unknown.assertStatus(401)
    unknown.assertBodyContains({ code: 'E_INVALID_CREDENTIALS' })
  })

  test('login is throttled after five failures', async ({ client }) => {
    await makeUser({ email: 'throttled@example.com' })
    const attempt = (password: string) =>
      client
        .post('/api/v1/auth/login')
        .withCsrfToken()
        .json({ email: 'throttled@example.com', password })

    for (let i = 0; i < 5; i++) {
      await expectStatus(attempt('wrong-password'), 401)
    }
    const blocked = await attempt(TEST_PASSWORD)
    blocked.assertStatus(429)
    blocked.assertBodyContains({ code: 'E_TOO_MANY_REQUESTS' })
    blocked.assertHeader('retry-after')
  })

  test('a spoofed cf-connecting-ip header does not reset the login throttle', async ({
    client,
  }) => {
    useTrustedProxy('none')
    await makeUser({ email: 'spoofed@example.com' })
    const attempt = (n: number) =>
      client
        .post('/api/v1/auth/login')
        .header('cf-connecting-ip', `203.0.113.${n}`)
        .withCsrfToken()
        .json({ email: 'spoofed@example.com', password: 'wrong-password' })

    for (let i = 0; i < 5; i++) {
      await expectStatus(attempt(i), 401)
    }
    const blocked = await attempt(99)
    blocked.assertStatus(429)
    blocked.assertBodyContains({ code: 'E_TOO_MANY_REQUESTS' })
  })

  test('cf-connecting-ip is honoured only when TRUSTED_PROXY is cloudflare', async ({ client }) => {
    useTrustedProxy('cloudflare')
    await makeUser({ email: 'proxied@example.com' })
    const attempt = (ip: string) =>
      client
        .post('/api/v1/auth/login')
        .header('cf-connecting-ip', ip)
        .withCsrfToken()
        .json({ email: 'proxied@example.com', password: 'wrong-password' })

    for (let i = 0; i < 5; i++) {
      await expectStatus(attempt('203.0.113.1'), 401)
    }
    await expectStatus(attempt('203.0.113.1'), 429)
    // Another client behind the CDN has its own per-IP allowance.
    await expectStatus(attempt('203.0.113.2'), 401)
  })

  test('login is throttled per e-mail regardless of ip', async ({ client }) => {
    useTrustedProxy('cloudflare')
    await makeUser({ email: 'targeted@example.com' })
    const attempt = (n: number, password = 'wrong-password') =>
      client
        .post('/api/v1/auth/login')
        .header('cf-connecting-ip', `198.51.100.${n}`)
        .withCsrfToken()
        .json({ email: 'targeted@example.com', password })

    for (let i = 0; i < 10; i++) {
      await expectStatus(attempt(i), 401)
    }
    const blocked = await attempt(200, TEST_PASSWORD)
    blocked.assertStatus(429)
    blocked.assertBodyContains({ code: 'E_TOO_MANY_REQUESTS' })
    // The cap is per address: another account from a fresh IP still signs in.
    await makeUser({ email: 'bystander@example.com' })
    await expectStatus(
      client
        .post('/api/v1/auth/login')
        .header('cf-connecting-ip', '198.51.100.201')
        .withCsrfToken()
        .json({ email: 'bystander@example.com', password: TEST_PASSWORD }),
      200
    )
  })

  test('a successful login clears the failure count', async ({ client }) => {
    await makeUser({ email: 'patient@example.com' })
    const attempt = (password: string) =>
      client
        .post('/api/v1/auth/login')
        .withCsrfToken()
        .json({ email: 'patient@example.com', password })

    for (let i = 0; i < 4; i++) {
      await expectStatus(attempt('wrong-password'), 401)
    }
    await expectStatus(attempt(TEST_PASSWORD), 200)
    for (let i = 0; i < 4; i++) {
      await expectStatus(attempt('wrong-password'), 401)
    }
    await expectStatus(attempt(TEST_PASSWORD), 200)
  })

  test('a disabled account cannot sign in', async ({ client }) => {
    await makeUser({ email: 'gone@example.com', status: 'disabled' })

    const response = await client
      .post('/api/v1/auth/login')
      .withCsrfToken()
      .json({ email: 'gone@example.com', password: TEST_PASSWORD })

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_ACCOUNT_DISABLED' })
  })

  test('without a session /auth/me answers 401 JSON', async ({ client }) => {
    const response = await client.get('/api/v1/auth/me')

    response.assertStatus(401)
    response.assertBodyContains({ code: 'E_UNAUTHORIZED' })
  })

  test('logout ends the session', async ({ client }) => {
    const user = await makeUser()

    const logout = await actingAs(client.post('/api/v1/auth/logout'), user)
    logout.assertStatus(204)

    const me = await client.get('/api/v1/auth/me').withSession(logout.session())
    me.assertStatus(401)
  })

  test('logout everywhere revokes other sessions', async ({ client, assert }) => {
    const user = await makeUser()
    const versionBefore = user.sessionVersion

    const logoutAll = await actingAs(client.post('/api/v1/auth/logout-all'), user)
    logoutAll.assertStatus(204)

    // The device that asked keeps working: its session carries the new version.
    const stillIn = await client.get('/api/v1/auth/me').withSession(logoutAll.session())
    stillIn.assertStatus(200)

    // Every other device still holds the old version and is signed out.
    const stale = await client
      .get('/api/v1/auth/me')
      .loginAs(user)
      .withSession({ auth_session_version: versionBefore })
    stale.assertStatus(401)
    stale.assertBodyContains({ code: 'E_UNAUTHORIZED' })
    await user.refresh()
    assert.equal(user.sessionVersion, versionBefore + 1)
  })

  test('a disabled account loses its open sessions', async ({ client }) => {
    const user = await makeUser()
    user.status = 'disabled'
    await user.save()

    const response = await actingAs(client.get('/api/v1/auth/me'), user)

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_ACCOUNT_DISABLED' })
  })

  test('the session cookie lives sixty days and is renewed on use', async ({ client, assert }) => {
    const user = await makeUser()

    const response = await actingAs(client.get('/api/v1/auth/me'), user)

    const cookies = response.headers()['set-cookie'] as unknown as string[] | undefined
    const cookie = cookies?.find((value: string) => value.startsWith('monkitrips_session='))
    assert.exists(cookie, 'the session cookie is re-sent on an authenticated request')
    assert.include(cookie!.toLowerCase(), `max-age=${60 * 24 * 60 * 60}`)
    assert.include(cookie!.toLowerCase(), 'httponly')
    assert.include(cookie!.toLowerCase(), 'samesite=lax')
  })

  test('the user model never serializes the hash or the session version', async ({ assert }) => {
    const user = await makeUser()
    const found = await User.findOrFail(user.id)
    const json = JSON.stringify(found.serialize())
    assert.notInclude(json, 'password')
    assert.notInclude(json, 'sessionVersion')
  })
})
