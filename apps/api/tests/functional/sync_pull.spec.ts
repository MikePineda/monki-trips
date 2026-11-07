import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import User from '#models/user'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { addMember, makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { mutation, pull, pushApplied, pushOne } from '#tests/helpers/sync'
import { decodeSyncCursor, encodeSyncCursor } from '#domain/sync_cursor'

type Change = { entity: string; row: Record<string, unknown> }

function ids(changes: Change[], entity: string): string[] {
  return changes.filter((c) => c.entity === entity).map((c) => c.row.id as string)
}

/** A second database connection, outside the test's global transaction: a real concurrent client. */
async function rawClient(): Promise<pg.Client> {
  const client = new pg.Client({
    host: env.get('DB_HOST'),
    port: env.get('DB_PORT'),
    user: env.get('DB_USER'),
    password: env.get('DB_PASSWORD').release(),
    database: env.get('DB_DATABASE'),
  })
  await client.connect()
  return client
}

test.group('Sync pull', (group) => {
  useFixedClock(group, new Date('2026-11-07T10:00:00Z'))

  test('without a cursor the answer is a snapshot of every live row of my trips', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser({ displayName: 'Owner' })
    const other = await makeUser()
    const trip = await makeTrip(owner)
    await makeTrip(other, { name: 'Not mine' })
    const stop = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'stop', { name: 'Harbour Town' })
    )
    const gone = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'stop', { name: 'Gone' })
    )
    await pushOne(client, owner, mutation(trip.id, 'stop', {}, { id: gone.id, op: 'delete' }))

    const response = await pull(client, owner)

    response.assertStatus(200)
    const { changes, tripIds, cursor, hasMore } = response.body().data
    assert.deepEqual(tripIds, [trip.id])
    assert.isFalse(hasMore)
    assert.isString(cursor)
    assert.deepEqual(ids(changes, 'trip'), [trip.id])
    assert.deepEqual(ids(changes, 'stop'), [stop.id])
    assert.lengthOf(ids(changes, 'member'), 1)
    assert.lengthOf(ids(changes, 'traveller'), 1)
    assert.lengthOf(ids(changes, 'budget_category'), 6)
    const member = changes.find((c: Change) => c.entity === 'member')!
    assert.include(member.row, { userId: owner.id, role: 'owner', displayName: 'Owner' })
    assert.isTrue(
      changes.every((c: Change) => c.row.deletedAt === null || c.row.deletedAt === undefined)
    )
  })

  test('with a cursor the answer is everything changed since, tombstones included', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const kept = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'stop', { name: 'Kept' })
    )
    const first = await pull(client, owner)
    const { cursor } = first.body().data

    const added = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'task', { title: 'Pack' })
    )
    await pushOne(client, owner, mutation(trip.id, 'stop', {}, { id: kept.id, op: 'delete' }))

    const second = await pull(client, owner, { cursor })
    const { changes, hasMore } = second.body().data
    assert.isFalse(hasMore)
    assert.deepEqual(ids(changes, 'task'), [added.id])
    assert.deepEqual(ids(changes, 'stop'), [kept.id])
    assert.isNotNull(changes.find((c: Change) => c.entity === 'stop')!.row.deletedAt)
    assert.isEmpty(ids(changes, 'trip'))

    const third = await pull(client, owner, { cursor: second.body().data.cursor })
    assert.deepEqual(third.body().data.changes, [])
  })

  test('pages with hasMore and a cursor that resumes where it left off', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    for (const name of ['A', 'B', 'C']) {
      await pushApplied(client, owner, mutation(trip.id, 'stop', { name }))
    }

    const seen: string[] = []
    let cursor: string | undefined
    let pages = 0
    for (;;) {
      const response = await pull(client, owner, { cursor, limit: 4 })
      const data = response.body().data
      seen.push(...data.changes.map((c: Change) => `${c.entity}:${c.row.id}`))
      pages += 1
      cursor = data.cursor
      if (!data.hasMore) break
    }

    // trip + member + traveller + 6 categories + 3 stops = 12 rows, 4 per page.
    assert.lengthOf(seen, 12)
    assert.lengthOf(new Set(seen), 12)
    assert.equal(pages, 3)
  })

  test('removed member stops receiving trip in pull', async ({ client, assert }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    const membership = await addMember(trip, editor)
    const before = await pull(client, editor)
    assert.deepEqual(before.body().data.tripIds, [trip.id])
    const { cursor } = before.body().data

    membership.deletedAt = DateTime.now()
    await membership.save()
    await pushApplied(client, owner, mutation(trip.id, 'stop', { name: 'After removal' }))

    const after = await pull(client, editor, { cursor })
    assert.deepEqual(after.body().data.tripIds, [])
    assert.deepEqual(after.body().data.changes, [])
    const snapshot = await pull(client, editor)
    assert.deepEqual(snapshot.body().data.changes, [])
  })

  test('a trip joined after the cursor arrives in full on the next pull', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    const own = await makeTrip(editor, { name: 'Own trip' })
    const stop = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'stop', { name: 'Before the join' })
    )
    const gone = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'task', { title: 'Deleted before the join' })
    )
    await pushOne(client, owner, mutation(trip.id, 'task', {}, { id: gone.id, op: 'delete' }))
    // The editor's own latest change puts their cursor past everything above.
    await pushApplied(client, editor, mutation(own.id, 'stop', { name: 'Own stop' }))
    const before = await pull(client, editor)
    let cursor: string = before.body().data.cursor

    await addMember(trip, editor)

    // Paged on purpose: the snapshot of the joined trip must survive page breaks.
    const seen: Change[] = []
    let tripIds: string[] = []
    for (let page = 0; page < 20; page += 1) {
      const response = await pull(client, editor, { cursor, limit: 3 })
      response.assertStatus(200)
      const data = response.body().data
      seen.push(...data.changes)
      tripIds = data.tripIds
      cursor = data.cursor
      if (!data.hasMore) break
    }

    assert.include(tripIds, trip.id)
    const ofTrip = seen.filter((c) => c.row.tripId === trip.id || c.row.id === trip.id)
    assert.include(ids(ofTrip, 'trip'), trip.id)
    assert.include(ids(ofTrip, 'stop'), stop.id)
    assert.lengthOf(new Set(ids(ofTrip, 'budget_category')), 6)
    assert.lengthOf(new Set(ids(ofTrip, 'member')), 2)
    assert.lengthOf(new Set(ids(ofTrip, 'traveller')), 2)
    assert.notInclude(ids(ofTrip, 'task'), gone.id, 'a snapshot carries no tombstones')

    // Once delivered, the trip is incremental again.
    const next = await pull(client, editor, { cursor })
    assert.deepEqual(next.body().data.changes, [])
  })

  test('a trip restored after the cursor arrives in full on the next pull', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, editor)
    const stop = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'stop', { name: 'Before the delete' })
    )
    const first = await pull(client, editor)
    assert.deepEqual(first.body().data.tripIds, [trip.id])

    const deleted = await actingAs(client.delete(`/api/v1/trips/${trip.id}`), owner)
    deleted.assertStatus(204)
    const whileDeleted = await pull(client, editor, { cursor: first.body().data.cursor })
    assert.deepEqual(whileDeleted.body().data.tripIds, [])
    const restore = await actingAs(client.post(`/api/v1/trips/${trip.id}/restore`), owner)
    restore.assertStatus(200)

    const restored = await pull(client, editor, { cursor: whileDeleted.body().data.cursor })

    const { changes, tripIds } = restored.body().data
    assert.deepEqual(tripIds, [trip.id])
    assert.include(ids(changes, 'trip'), trip.id)
    assert.include(ids(changes, 'stop'), stop.id)
    assert.lengthOf(ids(changes, 'budget_category'), 6)
  })

  test('expired cursor answers 410', async ({ client }) => {
    const owner = await makeUser()
    await makeTrip(owner)
    const old = encodeSyncCursor({
      xid: '1',
      seq: '1',
      issuedAt: Date.parse('2026-11-07T10:00:00Z') - 91 * 24 * 60 * 60 * 1000,
    })

    const response = await pull(client, owner, { cursor: old })

    response.assertStatus(410)
    response.assertBodyContains({ code: 'E_SYNC_CURSOR_EXPIRED' })
  })

  test('a cursor that is not ours answers 410 too, and a bad limit 422', async ({ client }) => {
    const owner = await makeUser()

    const garbage = await pull(client, owner, { cursor: 'not-a-cursor' })
    const limit = await pull(client, owner, { limit: 5000 })

    garbage.assertStatus(410)
    limit.assertStatus(422)
  })

  test('the cursor carries the change stamp and the issue time', async ({ client, assert }) => {
    const owner = await makeUser()
    await makeTrip(owner)

    const response = await pull(client, owner)

    const cursor = decodeSyncCursor(response.body().data.cursor)!
    assert.match(cursor.xid, /^\d+$/)
    assert.match(cursor.seq, /^\d+$/)
    assert.equal(cursor.issuedAt, Date.parse('2026-11-07T10:00:00Z'))
  })

  test('pull never skips a row committed by a concurrent transaction', async ({
    client,
    assert,
  }) => {
    // Everything here is committed for real (outside the test's transaction)
    // so a second connection can hold a transaction open against it.
    const writer = await rawClient()
    const slow = await rawClient()
    const userId = randomUUID()
    const tripId = randomUUID()
    try {
      await writer.query(
        `insert into users (id, email, password, display_name, email_verified_at)
         values ($1, $2, 'x', 'Concurrent owner', now())`,
        [userId, `concurrent-${userId}@example.com`]
      )
      await writer.query(
        `insert into trips (id, name, base_currency, starts_on, ends_on, created_by)
         values ($1, 'Concurrent', 'AUD', '2027-01-20', '2027-02-06', $2)`,
        [tripId, userId]
      )
      await writer.query(
        `insert into trip_members (trip_id, user_id, role) values ($1, $2, 'owner')`,
        [tripId, userId]
      )
      const user = await User.findOrFail(userId)

      // The slow transaction starts first (lower transaction id) and stays open...
      await slow.query('begin')
      const {
        rows: [{ xid: slowXid }],
      } = await slow.query('select pg_current_xact_id()::text as xid')
      // ...while a later transaction commits a row right away.
      const fastId = randomUUID()
      await writer.query(`insert into stops (id, trip_id, name) values ($1, $2, 'fast')`, [
        fastId,
        tripId,
      ])

      const first = await pull(client, user)
      first.assertStatus(200)
      const page = first.body().data
      assert.notInclude(ids(page.changes, 'stop'), fastId, 'a row above the snapshot xmin waits')
      assert.isTrue(BigInt(decodeSyncCursor(page.cursor)!.xid) < BigInt(slowXid))

      // Now the slow transaction writes its row and commits: it sorts before the fast one.
      const slowId = randomUUID()
      await slow.query(`insert into stops (id, trip_id, name) values ($1, $2, 'slow')`, [
        slowId,
        tripId,
      ])
      await slow.query('commit')

      const second = await pull(client, user, { cursor: page.cursor })
      second.assertStatus(200)
      assert.sameMembers(ids(second.body().data.changes, 'stop'), [slowId, fastId])

      const third = await pull(client, user, { cursor: second.body().data.cursor })
      assert.deepEqual(third.body().data.changes, [])
    } finally {
      await slow.query('rollback').catch(() => {})
      await writer.query('delete from trips where id = $1', [tripId])
      await writer.query('delete from users where id = $1', [userId])
      await writer.end()
      await slow.end()
    }
  })

  test('a person with no trips gets an empty snapshot and a usable cursor', async ({
    client,
    assert,
  }) => {
    const user = await makeUser()

    const response = await pull(client, user)

    assert.deepEqual(response.body().data, {
      changes: [],
      tripIds: [],
      cursor: response.body().data.cursor,
      hasMore: false,
    })
    assert.isNotNull(decodeSyncCursor(response.body().data.cursor))
    assert.isEmpty(await db.from('sync_mutations'))
  })
})
