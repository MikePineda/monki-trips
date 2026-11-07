import { test } from '@japa/runner'
import { actingAs } from '#tests/helpers/acting_as'
import { expectStatus } from '#tests/helpers/expect_status'
import { makeUser } from '#tests/helpers/make_user'

const SUBSCRIPTION = {
  endpoint: 'https://push.example.com/send/abc123',
  keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
  deviceLabel: 'Phone',
}

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
