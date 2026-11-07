import { test } from '@japa/runner'
import router from '@adonisjs/core/services/router'
import type { ApiClient, ApiRequest, ApiResponse } from '@japa/api-client'
import TripMember from '#models/trip_member'
import PushSubscription from '#models/push_subscription'
import type Trip from '#models/trip'
import type TripInvitation from '#models/trip_invitation'
import type User from '#models/user'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { addMember, makeInvitation, makeTrip } from '#tests/helpers/make_trip'

/**
 * The tenant boundary, route by route. Every route whose pattern carries
 * `:tripId` or `:id` needs a case here: the attacker (a verified account who
 * is not a member) calls it against the victim's data, gets 404
 * `E_ROW_NOT_FOUND` and changes nothing. A new scoped route without a case
 * fails the first test, so the boundary cannot erode silently.
 */

interface Victim {
  owner: User
  editor: User
  trip: Trip
  editorMembership: TripMember
  invitation: TripInvitation
  subscription: PushSubscription
}

interface IsolationCase {
  /** The attacker's request against the victim's identifiers. */
  request: (client: ApiClient, victim: Victim, attacker: User) => ApiRequest
  /** Proves the victim's data did not change. Defaults to the shared checks below. */
  unchanged?: (victim: Victim, assert: any) => Promise<void>
}

const CASES: Record<string, IsolationCase> = {
  'trips.snapshot': {
    request: (c, v, a) => actingAs(c.get(`/api/v1/trips/${v.trip.id}/snapshot`), a),
  },
  'trips.destroy': {
    request: (c, v, a) => actingAs(c.delete(`/api/v1/trips/${v.trip.id}`), a),
  },
  'trips.restore': {
    request: (c, v, a) => actingAs(c.post(`/api/v1/trips/${v.trip.id}/restore`), a),
  },
  'trips.transferOwnership': {
    request: (c, v, a) =>
      actingAs(c.post(`/api/v1/trips/${v.trip.id}/transfer-ownership`), a).json({ userId: a.id }),
  },
  'trips.members.index': {
    request: (c, v, a) => actingAs(c.get(`/api/v1/trips/${v.trip.id}/members`), a),
  },
  'trips.members.update': {
    request: (c, v, a) =>
      actingAs(c.patch(`/api/v1/trips/${v.trip.id}/members/${v.editorMembership.id}`), a).json({
        role: 'editor',
      }),
  },
  'trips.members.destroy': {
    request: (c, v, a) =>
      actingAs(c.delete(`/api/v1/trips/${v.trip.id}/members/${v.editorMembership.id}`), a),
  },
  'trips.invitations.index': {
    request: (c, v, a) => actingAs(c.get(`/api/v1/trips/${v.trip.id}/invitations`), a),
  },
  'trips.invitations.store': {
    request: (c, v, a) => actingAs(c.post(`/api/v1/trips/${v.trip.id}/invitations`), a).json({}),
  },
  'trips.invitations.destroy': {
    request: (c, v, a) =>
      actingAs(c.delete(`/api/v1/trips/${v.trip.id}/invitations/${v.invitation.id}`), a),
  },
  'me.pushSubscriptions.destroy': {
    request: (c, v, a) =>
      actingAs(c.delete(`/api/v1/me/push-subscriptions/${v.subscription.id}`), a),
  },
}

/** Routes whose pattern names a tenant-scoped parameter. */
function scopedRouteNames(): string[] {
  return router
    .toJSON()
    .root.filter((route) => /:tripId|:id\b/.test(route.pattern))
    .map((route) => route.name!)
    .sort()
}

async function makeVictim(): Promise<Victim> {
  const owner = await makeUser({ displayName: 'Victim owner' })
  const editor = await makeUser({ displayName: 'Victim editor' })
  const trip = await makeTrip(owner, { name: 'Private trip' })
  const editorMembership = await addMember(trip, editor)
  const { invitation } = await makeInvitation(trip, owner)
  const subscription = await PushSubscription.create({
    userId: owner.id,
    endpoint: 'https://push.example.com/victim',
    p256dh: 'k',
    auth: 'a',
  })
  return { owner, editor, trip, editorMembership, invitation, subscription }
}

async function assertUnchanged(victim: Victim, assert: any) {
  await victim.trip.refresh()
  assert.isNull(victim.trip.deletedAt)
  const members = await TripMember.query()
    .where('trip_id', victim.trip.id)
    .whereNull('deleted_at')
    .orderBy('role')
  assert.deepEqual(
    members.map((m) => [m.userId, m.role]),
    [
      [victim.editor.id, 'editor'],
      [victim.owner.id, 'owner'],
    ]
  )
  await victim.invitation.refresh()
  assert.isNull(victim.invitation.revokedAt)
  assert.isNotNull(await PushSubscription.find(victim.subscription.id))
}

test.group('Tenant isolation', () => {
  test('every route with :tripId or :id has an isolation case', ({ assert }) => {
    const routes = scopedRouteNames()
    assert.isNotEmpty(routes)
    assert.deepEqual(routes, Object.keys(CASES).sort())
  })

  test('{$self} answers 404 to a non-member and leaves the data unchanged')
    .with(Object.keys(CASES))
    .run(async ({ client, assert }, routeName) => {
      const victim = await makeVictim()
      const attacker = await makeUser({ displayName: 'Attacker' })
      await makeTrip(attacker, { name: 'Attacker trip' })
      const scenario = CASES[routeName]

      const response: ApiResponse = await scenario.request(client, victim, attacker)

      response.assertStatus(404)
      response.assertBodyContains({ code: 'E_ROW_NOT_FOUND' })
      await (scenario.unchanged ?? assertUnchanged)(victim, assert)
    })

  test('a member of the trip is not an attacker: the same routes answer 200 or 403, never 404', async ({
    client,
  }) => {
    const victim = await makeVictim()

    const asEditor = await actingAs(
      client.get(`/api/v1/trips/${victim.trip.id}/members`),
      victim.editor
    )
    asEditor.assertStatus(200)
    const ownerOnly = await actingAs(
      client.delete(`/api/v1/trips/${victim.trip.id}`),
      victim.editor
    )
    ownerOnly.assertStatus(403)
  })
})
