import { test } from '@japa/runner'
import { readFile, readdir } from 'node:fs/promises'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import router from '@adonisjs/core/services/router'
import type { ApiClient, ApiRequest, ApiResponse } from '@japa/api-client'
import TripMember from '#models/trip_member'
import PushSubscription from '#models/push_subscription'
import Trip from '#models/trip'
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
 *
 * The same cases also run with an ex-member as attacker (a soft-deleted
 * membership grants nothing), routes with two ids run with the attacker's
 * own trip and the victim's row id, and routes that take a tenant-scoped id
 * in the body (`BODY_SCOPED`) have their own cases; every `.uuid()` field of
 * a validator must be listed there.
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

/**
 * Routes with both `:tripId` and `:id`: the attacker passes a trip they own
 * and the victim's row id, which must not resolve across trips.
 */
const SWAPPED_ID_CASES: Record<string, IsolationCase> = {
  'trips.members.update': {
    request: (c, v, a) =>
      actingAs(c.patch(`/api/v1/trips/${ownTripOf(a)}/members/${v.editorMembership.id}`), a).json({
        role: 'editor',
      }),
  },
  'trips.members.destroy': {
    request: (c, v, a) =>
      actingAs(c.delete(`/api/v1/trips/${ownTripOf(a)}/members/${v.editorMembership.id}`), a),
  },
  'trips.invitations.destroy': {
    request: (c, v, a) =>
      actingAs(c.delete(`/api/v1/trips/${ownTripOf(a)}/invitations/${v.invitation.id}`), a),
  },
}

/** Routes that take a tenant-scoped id in the body, and that body field. */
const BODY_SCOPED: Record<string, string> = {
  'trips.store': 'id',
  'trips.transferOwnership': 'userId',
}

const BODY_CASES: Record<string, IsolationCase & { status: number; code: string }> = {
  // Re-posting the victim's trip id must neither reveal nor touch it.
  'trips.store': {
    status: 404,
    code: 'E_ROW_NOT_FOUND',
    request: (c, v, a) =>
      actingAs(c.post('/api/v1/trips'), a).json({
        id: v.trip.id,
        name: 'Hijacked',
        baseCurrency: 'EUR',
        startsOn: '2027-03-01',
        endsOn: '2027-03-02',
      }),
    unchanged: async (v, assert) => {
      await assertUnchanged(v, assert)
      assert.equal(v.trip.name, 'Private trip')
    },
  },
  // Handing the attacker's own trip to the victim must not make them a member.
  'trips.transferOwnership': {
    status: 404,
    code: 'E_NOT_A_MEMBER',
    request: (c, v, a) =>
      actingAs(c.post(`/api/v1/trips/${ownTripOf(a)}/transfer-ownership`), a).json({
        userId: v.owner.id,
      }),
    unchanged: async (v, assert) => {
      await assertUnchanged(v, assert)
      const victimMemberships = await TripMember.query().where('user_id', v.owner.id)
      assert.deepEqual(
        victimMemberships.map((m) => m.tripId),
        [v.trip.id]
      )
    },
  },
}

/** The attacker's own trip id, created by `makeAttacker`. */
const ownTrips = new Map<string, string>()
function ownTripOf(attacker: User): string {
  return ownTrips.get(attacker.id)!
}

async function makeAttacker(): Promise<User> {
  const attacker = await makeUser({ displayName: 'Attacker' })
  const own = await makeTrip(attacker, { name: 'Attacker trip' })
  ownTrips.set(attacker.id, own.id)
  return attacker
}

/** Body fields any validator declares as `.uuid()`: each one carries an id that may cross tenants. */
async function uuidBodyFields(): Promise<string[]> {
  const dir = app.makePath('app/validators')
  const fields = new Set<string>()
  for (const file of await readdir(dir)) {
    const source = await readFile(`${dir}/${file}`, 'utf8')
    for (const match of source.matchAll(/(\w+):\s*vine\s*\.string\(\)\s*\.uuid\(\)/g)) {
      fields.add(match[1])
    }
  }
  return [...fields].sort()
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

  test('every route with :tripId and :id has a swapped-id case', ({ assert }) => {
    const twoIds = router
      .toJSON()
      .root.filter((route) => /:tripId/.test(route.pattern) && /:id\b/.test(route.pattern))
      .map((route) => route.name!)
      .sort()
    assert.deepEqual(twoIds, Object.keys(SWAPPED_ID_CASES).sort())
  })

  test('every uuid body field belongs to a body-scoped route with a case', async ({ assert }) => {
    const names = router.toJSON().root.map((route) => route.name)
    for (const routeName of Object.keys(BODY_SCOPED)) {
      assert.include(names, routeName)
    }
    assert.deepEqual(Object.keys(BODY_CASES).sort(), Object.keys(BODY_SCOPED).sort())
    assert.deepEqual(await uuidBodyFields(), [...new Set(Object.values(BODY_SCOPED))].sort())
  })

  test('{$self} answers 404 to a non-member and leaves the data unchanged')
    .with(Object.keys(CASES))
    .run(async ({ client, assert }, routeName) => {
      const victim = await makeVictim()
      const attacker = await makeAttacker()
      const scenario = CASES[routeName]

      const response: ApiResponse = await scenario.request(client, victim, attacker)

      response.assertStatus(404)
      response.assertBodyContains({ code: 'E_ROW_NOT_FOUND' })
      await (scenario.unchanged ?? assertUnchanged)(victim, assert)
    })

  test('{$self} answers 404 to an ex-member and leaves the data unchanged')
    .with(Object.keys(CASES))
    .run(async ({ client, assert }, routeName) => {
      const victim = await makeVictim()
      const attacker = await makeAttacker()
      const former = await addMember(victim.trip, attacker)
      former.deletedAt = DateTime.now()
      await former.save()
      const scenario = CASES[routeName]

      const response: ApiResponse = await scenario.request(client, victim, attacker)

      response.assertStatus(404)
      response.assertBodyContains({ code: 'E_ROW_NOT_FOUND' })
      await (scenario.unchanged ?? assertUnchanged)(victim, assert)
    })

  test('{$self} with the attacker own trip and the victim row id answers 404')
    .with(Object.keys(SWAPPED_ID_CASES))
    .run(async ({ client, assert }, routeName) => {
      const victim = await makeVictim()
      const attacker = await makeAttacker()
      const scenario = SWAPPED_ID_CASES[routeName]

      const response: ApiResponse = await scenario.request(client, victim, attacker)

      response.assertStatus(404)
      response.assertBodyContains({ code: 'E_ROW_NOT_FOUND' })
      await (scenario.unchanged ?? assertUnchanged)(victim, assert)
    })

  test('{$self} with the victim id in the body is refused and changes nothing')
    .with(Object.keys(BODY_CASES))
    .run(async ({ client, assert }, routeName) => {
      const victim = await makeVictim()
      const attacker = await makeAttacker()
      const scenario = BODY_CASES[routeName]

      const response: ApiResponse = await scenario.request(client, victim, attacker)

      response.assertStatus(scenario.status)
      response.assertBodyContains({ code: scenario.code })
      await (scenario.unchanged ?? assertUnchanged)(victim, assert)
      assert.isNotNull(await Trip.find(ownTripOf(attacker)))
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
