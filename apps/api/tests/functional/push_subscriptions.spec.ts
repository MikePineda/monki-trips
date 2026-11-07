import { test } from '@japa/runner'
import { actingAs } from '#tests/helpers/acting_as'
import { expectStatus } from '#tests/helpers/expect_status'
import { useFakePushSender, withPushDisabled } from '#tests/helpers/fake_push'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { makeUser } from '#tests/helpers/make_user'

const SUBSCRIPTION = {
  endpoint: 'https://push.example.com/send/abc123',
  keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
  deviceLabel: 'Phone',
}

const TABLET = {
  endpoint: 'https://push.example.com/send/tablet456',
  keys: { p256dh: 'p256dh-key-2', auth: 'auth-secret-2' },
  deviceLabel: 'Tablet',
}

test.group('Push test notification', (group) => {
  const push = useFakePushSender(group)
  const clock = useFixedClock(group)

  test('test push reaches every subscription of the caller', async ({ client, assert, db }) => {
    const user = await makeUser({ locale: 'es' })
    const other = await makeUser()
    await expectStatus(
      actingAs(client.post('/api/v1/me/push-subscriptions'), user).json(SUBSCRIPTION),
      201
    )
    await expectStatus(
      actingAs(client.post('/api/v1/me/push-subscriptions'), user).json(TABLET),
      201
    )
    await expectStatus(
      actingAs(client.post('/api/v1/me/push-subscriptions'), other).json({
        ...SUBSCRIPTION,
        endpoint: 'https://push.example.com/send/someone-else',
      }),
      201
    )

    const response = await actingAs(client.post('/api/v1/me/push-subscriptions/test'), user)

    response.assertStatus(200)
    response.assertBodyContains({ data: { sent: 2, pruned: 0, failed: 0 } })
    assert.sameMembers(
      push.sent.map((sent) => sent.endpoint),
      [SUBSCRIPTION.endpoint, TABLET.endpoint]
    )
    // The payload is the shared PushPayload shape, in the recipient's locale.
    assert.deepEqual(push.sentTo(SUBSCRIPTION.endpoint)[0], {
      title: 'monki trips',
      body: 'Las notificaciones funcionan en este dispositivo.',
      url: '/settings',
      tag: 'test',
    })
    await db.assertHas('push_subscriptions', {
      endpoint: SUBSCRIPTION.endpoint,
      last_used_at: clock.at,
      failures: 0,
    })
  })

  test('a dead endpoint is pruned after the push provider answers 410', async ({ client, db }) => {
    const user = await makeUser()
    await expectStatus(
      actingAs(client.post('/api/v1/me/push-subscriptions'), user).json(SUBSCRIPTION),
      201
    )
    await expectStatus(
      actingAs(client.post('/api/v1/me/push-subscriptions'), user).json(TABLET),
      201
    )
    push.answerWith(TABLET.endpoint, 410)

    const response = await actingAs(client.post('/api/v1/me/push-subscriptions/test'), user)

    response.assertStatus(200)
    response.assertBodyContains({ data: { sent: 1, pruned: 1, failed: 0 } })
    await db.assertMissing('push_subscriptions', { endpoint: TABLET.endpoint })
    await db.assertHas('push_subscriptions', { endpoint: SUBSCRIPTION.endpoint })
  })

  test('a push service outage counts a failure and keeps the subscription', async ({
    client,
    db,
  }) => {
    const user = await makeUser()
    await expectStatus(
      actingAs(client.post('/api/v1/me/push-subscriptions'), user).json(SUBSCRIPTION),
      201
    )
    push.answerWith(SUBSCRIPTION.endpoint, 503)

    const response = await actingAs(client.post('/api/v1/me/push-subscriptions/test'), user)

    response.assertStatus(200)
    response.assertBodyContains({ data: { sent: 0, pruned: 0, failed: 1 } })
    await db.assertHas('push_subscriptions', { endpoint: SUBSCRIPTION.endpoint, failures: 1 })
  })

  test('push is disabled without vapid keys', async ({ client, assert }) => {
    const user = await makeUser()
    await expectStatus(
      actingAs(client.post('/api/v1/me/push-subscriptions'), user).json(SUBSCRIPTION),
      201
    )

    await withPushDisabled(async () => {
      const config = await client.get('/api/v1/config')
      config.assertStatus(200)
      assert.isFalse(config.body().data.pushEnabled)
      assert.isNull(config.body().data.vapidPublicKey)

      const response = await actingAs(client.post('/api/v1/me/push-subscriptions/test'), user)
      response.assertStatus(409)
      response.assertBodyContains({ code: 'E_PUSH_DISABLED' })
    })
    assert.lengthOf(push.sent, 0)
  })

  test('the test needs a session', async ({ client }) => {
    const response = await client.post('/api/v1/me/push-subscriptions/test').withCsrfToken()

    response.assertStatus(401)
  })
})

test.group('Push subscriptions', () => {
  test('registering a browser stores the subscription without echoing its keys', async ({
    client,
    db,
    assert,
  }) => {
    const user = await makeUser()

    const response = await actingAs(client.post('/api/v1/me/push-subscriptions'), user).json(
      SUBSCRIPTION
    )

    response.assertStatus(201)
    assert.include(response.body().data, { endpoint: SUBSCRIPTION.endpoint, deviceLabel: 'Phone' })
    assert.notProperty(response.body().data, 'auth')
    assert.notProperty(response.body().data, 'p256dh')
    await db.assertHas('push_subscriptions', { user_id: user.id, endpoint: SUBSCRIPTION.endpoint })
  })

  test('registering the same endpoint again updates the row instead of duplicating it', async ({
    client,
    db,
  }) => {
    const user = await makeUser()
    const other = await makeUser()
    await expectStatus(
      actingAs(client.post('/api/v1/me/push-subscriptions'), user).json(SUBSCRIPTION),
      201
    )

    const again = await actingAs(client.post('/api/v1/me/push-subscriptions'), other).json({
      ...SUBSCRIPTION,
      deviceLabel: 'Shared tablet',
    })

    again.assertStatus(200)
    await db.assertCount('push_subscriptions', 1)
    await db.assertHas('push_subscriptions', { endpoint: SUBSCRIPTION.endpoint, user_id: other.id })
  })

  test('an http endpoint is refused', async ({ client }) => {
    const user = await makeUser()

    const response = await actingAs(client.post('/api/v1/me/push-subscriptions'), user).json({
      ...SUBSCRIPTION,
      endpoint: 'http://push.example.com/send/abc123',
    })

    response.assertStatus(422)
  })

  test('deleting an own subscription removes it', async ({ client, db }) => {
    const user = await makeUser()
    const created = await actingAs(client.post('/api/v1/me/push-subscriptions'), user).json(
      SUBSCRIPTION
    )

    const response = await actingAs(
      client.delete(`/api/v1/me/push-subscriptions/${created.body().data.id}`),
      user
    )

    response.assertStatus(204)
    await db.assertMissing('push_subscriptions', { id: created.body().data.id })
  })

  test("another member's push subscription answers 404", async ({ client, db }) => {
    const owner = await makeUser()
    const other = await makeUser()
    const created = await actingAs(client.post('/api/v1/me/push-subscriptions'), owner).json(
      SUBSCRIPTION
    )

    const response = await actingAs(
      client.delete(`/api/v1/me/push-subscriptions/${created.body().data.id}`),
      other
    )

    response.assertStatus(404)
    response.assertBodyContains({ code: 'E_ROW_NOT_FOUND' })
    await db.assertHas('push_subscriptions', { id: created.body().data.id, user_id: owner.id })
  })
})
