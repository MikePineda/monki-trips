import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import router from '@adonisjs/core/services/router'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient, ApiRequest, ApiResponse } from '@japa/api-client'
import { SYNC_PUSH_ENTITIES, type SyncPushEntity } from '@monkitrips/shared'
import TripMember from '#models/trip_member'
import PushSubscription from '#models/push_subscription'
import Trip from '#models/trip'
import type TripInvitation from '#models/trip_invitation'
import type User from '#models/user'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { addMember, makeInvitation, makeTrip } from '#tests/helpers/make_trip'
import { mutation } from '#tests/helpers/sync'

/**
 * The tenant boundary, route by route. Every route whose pattern carries
 * `:tripId` or `:id` needs a case here: the attacker (a verified account who
 * is not a member) calls it against the victim's data, gets 404
 * `E_ROW_NOT_FOUND` and changes nothing. A new scoped route without a case
 * fails the first test, so the boundary cannot erode silently.
 *
 * The same cases also run with an ex-member as attacker (a soft-deleted
 * membership grants nothing), routes with two ids run with the attacker's
 * own trip and the victim's row id, routes that take a tenant-scoped id in
 * the body (`BODY_SCOPED`) have their own cases, and `sync.push` has one
 * case per entity (the victim's trip) and one per reference field (the
 * attacker's own trip pointing at the victim's rows). Every `.uuid()` field
 * of a validator must be listed in `BODY_SCOPED`.
 */

/** Content rows of the victim's trip the sync cases point at. */
interface VictimContent {
  stop: string
  event: string
  segment: string
  traveller: string
  document: string
  category: string
  expense: string
  share: string
  mutationId: string
  /** The owner's assistant conversation and a pending proposal in it. */
  conversation: string
  action: string
}

interface Victim {
  owner: User
  editor: User
  trip: Trip
  editorMembership: TripMember
  invitation: TripInvitation
  subscription: PushSubscription
  content: VictimContent
  /** Every content row of the trip, as it was created. */
  fingerprint: string
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
  'trips.nights': {
    request: (c, v, a) => actingAs(c.get(`/api/v1/trips/${v.trip.id}/nights`), a),
  },
  'trips.budget': {
    request: (c, v, a) => actingAs(c.get(`/api/v1/trips/${v.trip.id}/budget`), a),
  },
  'trips.today': {
    request: (c, v, a) => actingAs(c.get(`/api/v1/trips/${v.trip.id}/today`), a),
  },
  'trips.export': {
    request: (c, v, a) => actingAs(c.get(`/api/v1/trips/${v.trip.id}/export`), a),
  },
  'trips.documents.store': {
    request: (c, v, a) =>
      actingAs(c.post(`/api/v1/trips/${v.trip.id}/documents`), a)
        .field('title', 'Intruder')
        .file('file', Buffer.from('%PDF-1.4\n%fake\n'), { filename: 'intruder.pdf' }),
  },
  'trips.documents.file': {
    request: (c, v, a) =>
      actingAs(c.get(`/api/v1/trips/${v.trip.id}/documents/${v.content.document}/file`), a),
  },
  'trips.tasks.fromTemplate': {
    request: (c, v, a) => actingAs(c.post(`/api/v1/trips/${v.trip.id}/tasks/from-template`), a),
  },
  'trips.weather': {
    request: (c, v, a) => actingAs(c.get(`/api/v1/trips/${v.trip.id}/weather?date=2027-01-21`), a),
  },
  'trips.emergency.show': {
    request: (c, v, a) => actingAs(c.get(`/api/v1/trips/${v.trip.id}/emergency`), a),
  },
  'trips.emergency.update': {
    request: (c, v, a) =>
      actingAs(c.put(`/api/v1/trips/${v.trip.id}/emergency`), a).json({ notes: 'Intruder' }),
  },
  'trips.phraseCards.index': {
    request: (c, v, a) => actingAs(c.get(`/api/v1/trips/${v.trip.id}/phrase-cards`), a),
  },
  'trips.phraseCards.store': {
    request: (c, v, a) =>
      actingAs(c.post(`/api/v1/trips/${v.trip.id}/phrase-cards`), a).json({ language: 'ko' }),
  },
  'trips.phraseCards.destroy': {
    request: (c, v, a) => actingAs(c.delete(`/api/v1/trips/${v.trip.id}/phrase-cards/ja`), a),
  },
  'trips.ai.conversations.index': {
    request: (c, v, a) => actingAs(c.get(`/api/v1/trips/${v.trip.id}/ai/conversations`), a),
  },
  'trips.ai.conversations.store': {
    request: (c, v, a) =>
      actingAs(c.post(`/api/v1/trips/${v.trip.id}/ai/conversations`), a).json({ title: 'Spy' }),
  },
  'trips.ai.conversations.show': {
    request: (c, v, a) =>
      actingAs(c.get(`/api/v1/trips/${v.trip.id}/ai/conversations/${v.content.conversation}`), a),
  },
  'trips.ai.conversations.destroy': {
    request: (c, v, a) =>
      actingAs(
        c.delete(`/api/v1/trips/${v.trip.id}/ai/conversations/${v.content.conversation}`),
        a
      ),
  },
  'trips.ai.conversations.message': {
    request: (c, v, a) =>
      actingAs(
        c.post(`/api/v1/trips/${v.trip.id}/ai/conversations/${v.content.conversation}/messages`),
        a
      ).json({ text: 'Show me everything' }),
  },
  'trips.ai.actions.accept': {
    request: (c, v, a) =>
      actingAs(c.post(`/api/v1/trips/${v.trip.id}/ai/actions/${v.content.action}/accept`), a),
  },
  'trips.ai.actions.reject': {
    request: (c, v, a) =>
      actingAs(c.post(`/api/v1/trips/${v.trip.id}/ai/actions/${v.content.action}/reject`), a),
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
  'trips.documents.file': {
    request: (c, v, a) =>
      actingAs(c.get(`/api/v1/trips/${ownTripOf(a)}/documents/${v.content.document}/file`), a),
  },
  'trips.ai.conversations.show': {
    request: (c, v, a) =>
      actingAs(
        c.get(`/api/v1/trips/${ownTripOf(a)}/ai/conversations/${v.content.conversation}`),
        a
      ),
  },
  'trips.ai.conversations.destroy': {
    request: (c, v, a) =>
      actingAs(
        c.delete(`/api/v1/trips/${ownTripOf(a)}/ai/conversations/${v.content.conversation}`),
        a
      ),
  },
  'trips.ai.conversations.message': {
    request: (c, v, a) =>
      actingAs(
        c.post(`/api/v1/trips/${ownTripOf(a)}/ai/conversations/${v.content.conversation}/messages`),
        a
      ).json({ text: 'Show me everything' }),
  },
  'trips.ai.actions.accept': {
    request: (c, v, a) =>
      actingAs(c.post(`/api/v1/trips/${ownTripOf(a)}/ai/actions/${v.content.action}/accept`), a),
  },
  'trips.ai.actions.reject': {
    request: (c, v, a) =>
      actingAs(c.post(`/api/v1/trips/${ownTripOf(a)}/ai/actions/${v.content.action}/reject`), a),
  },
}

/** Routes that take tenant-scoped ids in the body, and those body fields. */
const BODY_SCOPED: Record<string, string[]> = {
  'trips.store': ['id'],
  'trips.transferOwnership': ['userId'],
  'trips.documents.store': ['id', 'eventId'],
  'sync.push': [
    'mutationId',
    'tripId',
    'id',
    'stopId',
    'eventId',
    'segmentId',
    'travellerId',
    'documentId',
    'categoryId',
    'paidByTravellerId',
    'expenseId',
  ],
}

type BodyCase = IsolationCase & { expect: (response: ApiResponse, assert: any) => void }

const notFound = (response: ApiResponse) => {
  response.assertStatus(404)
  response.assertBodyContains({ code: 'E_ROW_NOT_FOUND' })
}

const BODY_CASES: Record<string, BodyCase> = {
  // Re-posting the victim's trip id must neither reveal nor touch it.
  'trips.store': {
    expect: notFound,
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
    expect: (response) => {
      response.assertStatus(404)
      response.assertBodyContains({ code: 'E_NOT_A_MEMBER' })
    },
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
  // Uploading into the attacker's own trip with the victim's document id or event id.
  'trips.documents.store': {
    expect: notFound,
    request: (c, v, a) =>
      actingAs(c.post(`/api/v1/trips/${ownTripOf(a)}/documents`), a)
        .field('id', v.content.document)
        .field('eventId', v.content.event)
        .file('file', Buffer.from('%PDF-1.4\n%fake\n'), { filename: 'own.pdf' }),
  },
  'sync.push': {
    expect: rejectedWith('E_ROW_NOT_FOUND'),
    request: (c, v, a) =>
      actingAs(c.post('/api/v1/sync/push'), a).json({
        mutations: [mutation(v.trip.id, 'stop', { name: 'Intruder' })],
      }),
  },
}

/** `sync.push` answers 200 and rejects the mutation itself. */
function rejectedWith(code: string) {
  return (response: ApiResponse, assert: any) => {
    response.assertStatus(200)
    const [result] = response.body().data.results
    assert.equal(result.status, 'rejected')
    assert.equal(result.error.code, code)
    assert.notProperty(result, 'row')
  }
}

/** One push per entity into the victim's trip, as a non-member. */
const SYNC_ENTITY_CHANGES: Record<SyncPushEntity, (v: Victim) => Record<string, unknown>> = {
  trip: () => ({ name: 'Hijacked' }),
  traveller: () => ({ displayName: 'Intruder' }),
  stop: () => ({ name: 'Intruder' }),
  event: () => ({ kind: 'tour', title: 'Intruder' }),
  segment: (v) => ({
    eventId: v.content.event,
    departsLocal: '2027-01-21T10:00',
    departsTz: 'UTC',
    arrivesLocal: '2027-01-21T12:00',
    arrivesTz: 'UTC',
  }),
  seat: (v) => ({ segmentId: v.content.segment, travellerId: v.content.traveller }),
  document: () => ({ kind: 'link', title: 'Intruder', url: 'https://example.com/x' }),
  task: () => ({ title: 'Intruder' }),
  budget_category: () => ({ name: 'Intruder' }),
  expense: () => ({ amountMinor: 100, currency: 'AUD', spentOn: '2027-01-21' }),
  expense_share: (v) => ({
    expenseId: v.content.expense,
    travellerId: v.content.traveller,
    shareMinor: 100,
  }),
  emergency: () => ({ notes: 'Intruder' }),
}

/**
 * One push per reference field into the attacker's own trip, pointing at a
 * row of the victim's trip; `mutationId` replays the victim's mutation. A
 * field used by several entities has one case per use, keyed
 * `field (where)`; every field of `BODY_SCOPED['sync.push']` needs at least
 * one.
 */
const SYNC_REFERENCE_CASES: Record<
  string,
  { code: string; build: (v: Victim, own: string) => object }
> = {
  'mutationId': {
    code: 'E_CONFLICT',
    build: (v, own) =>
      mutation(own, 'stop', { name: 'Replay' }, { mutationId: v.content.mutationId }),
  },
  'tripId': { code: 'E_ROW_NOT_FOUND', build: (v) => mutation(v.trip.id, 'stop', { name: 'x' }) },
  'id': {
    code: 'E_ROW_NOT_FOUND',
    build: (v, own) => mutation(own, 'event', { title: 'Steal' }, { id: v.content.event }),
  },
  'stopId': {
    code: 'E_ROW_NOT_FOUND',
    build: (v, own) => mutation(own, 'event', { kind: 'tour', title: 'x', stopId: v.content.stop }),
  },
  'eventId': {
    code: 'E_ROW_NOT_FOUND',
    build: (v, own) => mutation(own, 'task', { title: 'x', eventId: v.content.event }),
  },
  'segmentId': {
    code: 'E_ROW_NOT_FOUND',
    build: (v, own) =>
      mutation(own, 'seat', { segmentId: v.content.segment, travellerId: ownTravellerOf(own) }),
  },
  'id (expense shares)': {
    code: 'E_ROW_NOT_FOUND',
    build: (v, own) =>
      mutation(own, 'expense', {
        amountMinor: 100,
        currency: 'AUD',
        spentOn: '2027-01-21',
        shares: [{ id: v.content.share, travellerId: ownTravellerOf(own), shareMinor: 100 }],
      }),
  },
  'travellerId (expense shares)': {
    code: 'E_ROW_NOT_FOUND',
    build: (v, own) =>
      mutation(own, 'expense', {
        amountMinor: 100,
        currency: 'AUD',
        spentOn: '2027-01-21',
        shares: [{ id: randomUUID(), travellerId: v.content.traveller, shareMinor: 100 }],
      }),
  },
  'travellerId (seat)': {
    code: 'E_ROW_NOT_FOUND',
    build: (v, own) =>
      mutation(own, 'seat', { segmentId: ownSegmentOf(own), travellerId: v.content.traveller }),
  },
  'travellerId (expense_share)': {
    code: 'E_ROW_NOT_FOUND',
    build: (v, own) =>
      mutation(own, 'expense_share', {
        expenseId: ownExpenseOf(own),
        travellerId: v.content.traveller,
        shareMinor: 100,
      }),
  },
  'documentId': {
    code: 'E_ROW_NOT_FOUND',
    build: (v, own) =>
      mutation(own, 'seat', {
        segmentId: ownSegmentOf(own),
        travellerId: ownTravellerOf(own),
        documentId: v.content.document,
      }),
  },
  'categoryId': {
    code: 'E_ROW_NOT_FOUND',
    build: (v, own) =>
      mutation(own, 'expense', {
        amountMinor: 100,
        currency: 'AUD',
        spentOn: '2027-01-21',
        categoryId: v.content.category,
      }),
  },
  'paidByTravellerId': {
    code: 'E_ROW_NOT_FOUND',
    build: (v, own) =>
      mutation(own, 'expense', {
        amountMinor: 100,
        currency: 'AUD',
        spentOn: '2027-01-21',
        paidByTravellerId: v.content.traveller,
      }),
  },
  'expenseId': {
    code: 'E_ROW_NOT_FOUND',
    build: (v, own) =>
      mutation(own, 'expense_share', {
        expenseId: v.content.expense,
        travellerId: ownTravellerOf(own),
        shareMinor: 100,
      }),
  },
}

/** The attacker's own trip, traveller, segment and expense ids, created by `makeAttacker`. */
const ownTrips = new Map<string, string>()
const ownTravellers = new Map<string, string>()
const ownSegments = new Map<string, string>()
const ownExpenses = new Map<string, string>()
function ownTripOf(attacker: User): string {
  return ownTrips.get(attacker.id)!
}
function ownTravellerOf(tripId: string): string {
  return ownTravellers.get(tripId)!
}
function ownSegmentOf(tripId: string): string {
  return ownSegments.get(tripId)!
}
function ownExpenseOf(tripId: string): string {
  return ownExpenses.get(tripId)!
}
/** The field a reference case covers: its key without the `(where)` suffix. */
function referenceField(caseName: string): string {
  return caseName.split(' ')[0]
}

async function makeAttacker(): Promise<User> {
  const attacker = await makeUser({ displayName: 'Attacker' })
  const own = await makeTrip(attacker, { name: 'Attacker trip' })
  ownTrips.set(attacker.id, own.id)
  const [traveller] = await db.from('travellers').where('trip_id', own.id)
  ownTravellers.set(own.id, traveller.id)
  const [event] = await db
    .table('events')
    .insert({ trip_id: own.id, kind: 'flight', title: 'Own flight' })
    .returning('id')
  const [segment] = await db
    .table('event_segments')
    .insert({
      event_id: event.id,
      trip_id: own.id,
      departs_local: '2027-01-21T10:00:00',
      departs_tz: 'UTC',
      departs_at: '2027-01-21T10:00:00Z',
      arrives_local: '2027-01-21T12:00:00',
      arrives_tz: 'UTC',
      arrives_at: '2027-01-21T12:00:00Z',
    })
    .returning('id')
  ownSegments.set(own.id, segment.id)
  const [expense] = await db
    .table('expenses')
    .insert({
      trip_id: own.id,
      amount_minor: 100,
      currency: 'AUD',
      fx_rate: '1',
      fx_source: 'identity',
      base_amount_minor: 100,
      spent_on: '2027-01-21',
    })
    .returning('id')
  ownExpenses.set(own.id, expense.id)
  return attacker
}

/** Body fields any validator declares as a UUID (`vine.string().uuid()` or the shared `refField`). */
async function uuidBodyFields(): Promise<string[]> {
  const fields = new Set<string>()
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
        continue
      }
      const source = await readFile(path, 'utf8')
      for (const match of source.matchAll(
        /(\w+):\s*(?:vine\s*\.string\(\)\s*\.uuid\(\)|refField)/g
      )) {
        fields.add(match[1])
      }
    }
  }
  await walk(app.makePath('app/validators'))
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

const CONTENT_TABLES = [
  'stops',
  'events',
  'event_segments',
  'segment_seats',
  'documents',
  'tasks',
  'budget_categories',
  'expenses',
  'expense_shares',
  'emergency_info',
  'phrase_cards',
  'trip_activity',
  'ai_conversations',
  'ai_messages',
  'ai_actions',
]

async function fingerprintOf(tripId: string): Promise<string> {
  const parts: unknown[] = []
  for (const table of CONTENT_TABLES) {
    const rows = await db.from(table).where('trip_id', tripId).orderBy('created_at')
    parts.push([
      table,
      rows
        .map((row) => ({ ...row, updated_at: null, change_seq: null }))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    ])
  }
  return JSON.stringify(parts)
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
  const [traveller] = await db
    .from('travellers')
    .where('trip_id', trip.id)
    .where('user_id', owner.id)
  const [category] = await db
    .from('budget_categories')
    .where('trip_id', trip.id)
    .orderBy('position')
  const [stop] = await db
    .table('stops')
    .insert({ trip_id: trip.id, name: 'Private stop' })
    .returning('id')
  const [event] = await db
    .table('events')
    .insert({ trip_id: trip.id, kind: 'flight', title: 'Private flight' })
    .returning('id')
  const [segment] = await db
    .table('event_segments')
    .insert({
      event_id: event.id,
      trip_id: trip.id,
      departs_local: '2027-01-21T10:00:00',
      departs_tz: 'UTC',
      departs_at: '2027-01-21T10:00:00Z',
      arrives_local: '2027-01-21T12:00:00',
      arrives_tz: 'UTC',
      arrives_at: '2027-01-21T12:00:00Z',
    })
    .returning('id')
  const [document] = await db
    .table('documents')
    .insert({
      trip_id: trip.id,
      kind: 'file',
      title: 'Private voucher',
      storage_key: `trips/${trip.id}/private`,
      mime: 'application/pdf',
      size_bytes: 3,
      sha256: 'abc',
      tags: ['print'],
    })
    .returning('id')
  const [expense] = await db
    .table('expenses')
    .insert({
      trip_id: trip.id,
      amount_minor: 1000,
      currency: 'AUD',
      fx_rate: '1',
      fx_source: 'identity',
      base_amount_minor: 1000,
      spent_on: '2027-01-21',
    })
    .returning('id')
  const [share] = await db
    .table('expense_shares')
    .insert({
      trip_id: trip.id,
      expense_id: expense.id,
      traveller_id: traveller.id,
      share_minor: 1000,
    })
    .returning('id')
  await db.table('phrase_cards').insert({
    trip_id: trip.id,
    language: 'ja',
    cards: JSON.stringify([]),
    created_by: owner.id,
  })
  const mutationId = randomUUID()
  await db.table('sync_mutations').insert({
    id: mutationId,
    user_id: owner.id,
    trip_id: trip.id,
    status: 'applied',
    response: JSON.stringify({ mutationId, status: 'applied' }),
  })
  const [conversation] = await db
    .table('ai_conversations')
    .insert({ trip_id: trip.id, user_id: owner.id, title: 'Private chat' })
    .returning('id')
  const [message] = await db
    .table('ai_messages')
    .insert({
      conversation_id: conversation.id,
      trip_id: trip.id,
      role: 'assistant',
      content: 'Private answer',
    })
    .returning('id')
  // A pending proposal that would add a stop to the victim's trip if anyone could accept it.
  const [action] = await db
    .table('ai_actions')
    .insert({
      trip_id: trip.id,
      conversation_id: conversation.id,
      message_id: message.id,
      user_id: owner.id,
      tool: 'create_task',
      proposal: JSON.stringify({ kind: 'task', title: 'Private task' }),
      mutations: JSON.stringify([mutation(trip.id, 'task', { title: 'Accepted by an intruder' })]),
      expires_at: DateTime.now().plus({ days: 1 }).toJSDate(),
    })
    .returning('id')
  const content: VictimContent = {
    stop: stop.id,
    event: event.id,
    segment: segment.id,
    traveller: traveller.id,
    document: document.id,
    category: category.id,
    expense: expense.id,
    share: share.id,
    mutationId,
    conversation: conversation.id,
    action: action.id,
  }
  return {
    owner,
    editor,
    trip,
    editorMembership,
    invitation,
    subscription,
    content,
    fingerprint: await fingerprintOf(trip.id),
  }
}

async function assertUnchanged(victim: Victim, assert: any) {
  await victim.trip.refresh()
  assert.isNull(victim.trip.deletedAt)
  assert.equal(victim.trip.name, 'Private trip')
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
  assert.equal(await fingerprintOf(victim.trip.id), victim.fingerprint, 'trip content changed')
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
    assert.deepEqual(await uuidBodyFields(), [...new Set(Object.values(BODY_SCOPED).flat())].sort())
    assert.deepEqual(
      [...new Set(Object.keys(SYNC_REFERENCE_CASES).map(referenceField))].sort(),
      [...BODY_SCOPED['sync.push']].sort()
    )
    assert.deepEqual(Object.keys(SYNC_ENTITY_CHANGES).sort(), [...SYNC_PUSH_ENTITIES].sort())
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

      scenario.expect(response, assert)
      await (scenario.unchanged ?? assertUnchanged)(victim, assert)
      assert.isNotNull(await Trip.find(ownTripOf(attacker)))
    })

  test('sync.push of a {$self} into the victim trip is rejected as not found and changes nothing')
    .with([...SYNC_PUSH_ENTITIES])
    .run(async ({ client, assert }, entity) => {
      const victim = await makeVictim()
      const attacker = await makeAttacker()
      const id = entity === 'trip' || entity === 'emergency' ? victim.trip.id : randomUUID()

      const response: ApiResponse = await actingAs(client.post('/api/v1/sync/push'), attacker).json(
        {
          mutations: [
            mutation(victim.trip.id, entity, SYNC_ENTITY_CHANGES[entity](victim), { id }),
          ],
        }
      )

      rejectedWith('E_ROW_NOT_FOUND')(response, assert)
      await assertUnchanged(victim, assert)
      assert.isEmpty(await db.from('sync_mutations').where('user_id', attacker.id))
    })

  test(
    'sync.push with the victim {$self} from the attacker own trip is rejected and changes nothing'
  )
    .with(Object.keys(SYNC_REFERENCE_CASES))
    .run(async ({ client, assert }, field) => {
      const victim = await makeVictim()
      const attacker = await makeAttacker()
      const scenario = SYNC_REFERENCE_CASES[field]

      const response: ApiResponse = await actingAs(client.post('/api/v1/sync/push'), attacker).json(
        {
          mutations: [scenario.build(victim, ownTripOf(attacker))],
        }
      )

      rejectedWith(scenario.code)(response, assert)
      await assertUnchanged(victim, assert)
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
