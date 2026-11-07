import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import {
  BUDGET_MODES,
  DOCUMENT_KINDS,
  EVENT_KINDS,
  EVENT_STATUSES,
  FX_SOURCES,
  TASK_ORIGINS,
  TASK_PRIORITIES,
  THEMES,
  TRIP_MEMBER_ROLES,
  USER_PLANS,
  USER_STATUSES,
  USER_TOKEN_PURPOSES,
} from '@monkitrips/shared'
import { SYNC_COLUMNS } from '#database/sync_columns'

/** Tables the plan marks "S": they carry the sync columns and the stamp trigger. */
const SYNCABLE_TABLES = [
  'trips',
  'trip_members',
  'travellers',
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
]

const EXPECTED_TABLES = [
  'users',
  'user_tokens',
  'rate_limits',
  'trips',
  'trip_members',
  'trip_invitations',
  'travellers',
  'push_subscriptions',
  'llm_usage',
  'sync_mutations',
  'scheduler_runs',
  'stops',
  'events',
  'event_segments',
  'segment_seats',
  'documents',
  'tasks',
  'budget_categories',
  'expenses',
  'expense_shares',
  'fx_rates',
  'emergency_info',
  'phrase_cards',
  'trip_activity',
]

async function columnsOf(table: string): Promise<string[]> {
  const { rows } = await db.rawQuery(
    `select column_name from information_schema.columns where table_name = ?`,
    [table]
  )
  return rows.map((row: { column_name: string }) => row.column_name)
}

/**
 * Whether the row is accepted. Runs in a nested transaction (a savepoint
 * under the test's global transaction) so a rejected insert does not abort
 * the rest of the test.
 */
async function checkAccepts(table: string, column: string, value: string, base: object) {
  try {
    await db.transaction((trx) => trx.table(table).insert({ ...base, [column]: value }))
    return true
  } catch {
    return false
  }
}

async function insertUser(email = 'owner@example.com') {
  const [user] = await db
    .table('users')
    .insert({ email, password: 'x', display_name: 'Owner' })
    .returning('id')
  return user.id as string
}

async function insertTrip(createdBy: string) {
  const [trip] = await db
    .table('trips')
    .insert({
      name: 'Demo Loop',
      base_currency: 'AUD',
      starts_on: '2027-01-20',
      ends_on: '2027-02-06',
      created_by: createdBy,
    })
    .returning('id')
  return trip.id as string
}

test.group('Schema', () => {
  test('every table of the package exists after migrating', async ({ assert }) => {
    const { rows } = await db.rawQuery(
      `select table_name from information_schema.tables where table_schema = 'public'`
    )
    const tables = rows.map((row: { table_name: string }) => row.table_name)
    for (const table of EXPECTED_TABLES) assert.include(tables, table)
  })

  test('no column uses a native enum type', async ({ assert }) => {
    const { rows } = await db.rawQuery(
      `select count(*)::int as count from pg_type where typtype = 'e'`
    )
    assert.equal(rows[0].count, 0)
  })

  test('{$self} carries the sync columns, the cursor index and the stamp trigger')
    .with(SYNCABLE_TABLES)
    .run(async ({ assert }, table) => {
      const columns = await columnsOf(table)
      for (const column of SYNC_COLUMNS) assert.include(columns, column, `${table}.${column}`)

      const { rows: triggers } = await db.rawQuery(
        `select tgname from pg_trigger where tgrelid = ?::regclass and not tgisinternal`,
        [table]
      )
      assert.includeMembers(
        triggers.map((row: { tgname: string }) => row.tgname),
        [`${table}_sync_stamp`]
      )

      const { rows: indexes } = await db.rawQuery(
        `select indexname from pg_indexes where tablename = ?`,
        [table]
      )
      assert.include(
        indexes.map((row: { indexname: string }) => row.indexname),
        `${table}_sync_cursor_idx`
      )
    })

  test('inserting a trip stamps the sync columns through the trigger', async ({ assert }) => {
    const owner = await insertUser()
    const tripId = await insertTrip(owner)
    const [row] = await db.from('trips').where('id', tripId)
    assert.isNotNull(row.change_xid)
    assert.isNotNull(row.change_seq)
    assert.deepEqual(row.field_clock, {})
  })

  test('users.email must be lowercase and unique', async ({ assert }) => {
    await insertUser('lower@example.com')
    assert.isFalse(
      await checkAccepts('users', 'email', 'Upper@example.com', {
        password: 'x',
        display_name: 'Someone',
      })
    )
    assert.isFalse(
      await checkAccepts('users', 'email', 'lower@example.com', {
        password: 'x',
        display_name: 'Twin',
      })
    )
  })

  test('check constraints mirror the shared enums: {$self}')
    .with([
      { table: 'users', column: 'status', values: USER_STATUSES },
      { table: 'users', column: 'plan', values: USER_PLANS },
      { table: 'users', column: 'theme', values: THEMES },
      { table: 'trips', column: 'budget_mode', values: BUDGET_MODES },
      { table: 'trip_members', column: 'role', values: TRIP_MEMBER_ROLES },
      { table: 'user_tokens', column: 'purpose', values: USER_TOKEN_PURPOSES },
      { table: 'events', column: 'kind', values: EVENT_KINDS },
      { table: 'events', column: 'status', values: EVENT_STATUSES },
      { table: 'documents', column: 'kind', values: DOCUMENT_KINDS },
      { table: 'tasks', column: 'priority', values: TASK_PRIORITIES },
      { table: 'tasks', column: 'origin', values: TASK_ORIGINS },
      { table: 'expenses', column: 'fx_source', values: FX_SOURCES },
    ])
    .run(async ({ assert }, { table, column, values }) => {
      const owner = await insertUser()
      const tripId = table === 'users' ? undefined : await insertTrip(owner)
      const bases: Record<string, () => object> = {
        users: () => ({
          email: `${crypto.randomUUID()}@example.com`,
          password: 'x',
          display_name: 'P',
        }),
        trips: () => ({
          name: 'T',
          base_currency: 'EUR',
          starts_on: '2027-01-01',
          ends_on: '2027-01-02',
        }),
        trip_members: () => ({
          trip_id: tripId,
          user_id: owner,
          // The one-owner index would reject a second owner; use a fresh trip per value below.
        }),
        user_tokens: () => ({
          user_id: owner,
          token_hash: crypto.randomUUID(),
          expires_at: new Date(),
        }),
        events: () => ({ trip_id: tripId, kind: 'tour', title: 'T' }),
        documents: () => ({
          trip_id: tripId,
          kind: 'link',
          title: 'T',
          url: 'https://example.com',
        }),
        tasks: () => ({ trip_id: tripId, title: 'T' }),
        expenses: () => ({
          trip_id: tripId,
          amount_minor: 100,
          currency: 'AUD',
          fx_rate: '1',
          base_amount_minor: 100,
          spent_on: '2027-01-21',
        }),
      }
      for (const value of values) {
        let base =
          table === 'trip_members'
            ? { trip_id: await insertTrip(owner), user_id: owner }
            : bases[table]()
        if (table === 'documents') base = { ...base, storage_key: 'k', url: 'https://example.com' }
        assert.isTrue(await checkAccepts(table, column, value, base), `${table}.${column}=${value}`)
      }
      assert.isFalse(
        await checkAccepts(table, column, 'not-a-real-value', bases[table]()),
        `${table}.${column} rejects an unknown value`
      )
    })

  test('content tables enforce the plan checks: {$self}')
    .with([
      { name: 'cost pair', table: 'events', row: { kind: 'tour', title: 'T', cost_minor: 100 } },
      {
        name: 'unknown tag',
        table: 'documents',
        row: { kind: 'link', title: 'T', url: 'https://example.com', tags: ['print', 'frame'] },
      },
      { name: 'file without storage key', table: 'documents', row: { kind: 'file', title: 'T' } },
      {
        name: 'rate without base amount',
        table: 'expenses',
        row: { amount_minor: 100, currency: 'AUD', fx_rate: '1', spent_on: '2027-01-21' },
      },
      {
        name: 'zero amount',
        table: 'expenses',
        row: { amount_minor: 0, currency: 'AUD', spent_on: '2027-01-21' },
      },
      { name: 'category without key or name', table: 'budget_categories', row: {} },
      {
        name: 'stop departing before arriving',
        table: 'stops',
        row: { name: 'S', arrive_on: '2027-01-22', depart_on: '2027-01-21' },
      },
    ])
    .run(async ({ assert }, { table, row }) => {
      const owner = await insertUser()
      const tripId = await insertTrip(owner)
      assert.isFalse(await checkAccepts(table, 'trip_id', tripId, row))
    })

  test('partial unique indexes keep one live row per key', async ({ assert }) => {
    const owner = await insertUser()
    const tripId = await insertTrip(owner)
    const [event] = await db
      .table('events')
      .insert({ trip_id: tripId, kind: 'flight', title: 'F' })
      .returning('id')
    const leg = {
      event_id: event.id,
      position: 1,
      departs_local: '2027-01-21T10:00:00',
      departs_tz: 'UTC',
      departs_at: '2027-01-21T10:00:00Z',
      arrives_local: '2027-01-21T12:00:00',
      arrives_tz: 'UTC',
      arrives_at: '2027-01-21T12:00:00Z',
    }
    await db.table('event_segments').insert({ ...leg, trip_id: tripId, deleted_at: new Date() })
    assert.isTrue(await checkAccepts('event_segments', 'trip_id', tripId, leg))
    assert.isFalse(await checkAccepts('event_segments', 'trip_id', tripId, leg))
    assert.isTrue(await checkAccepts('budget_categories', 'trip_id', tripId, { key: 'food' }))
    assert.isFalse(await checkAccepts('budget_categories', 'trip_id', tripId, { key: 'food' }))
  })

  test('deleting a trip cascades to its content', async ({ assert }) => {
    const owner = await insertUser()
    const tripId = await insertTrip(owner)
    await db.table('stops').insert({ trip_id: tripId, name: 'S' })
    await db
      .table('emergency_info')
      .insert({ trip_id: tripId, content: JSON.stringify({ notes: 'x' }) })
    await db
      .table('trip_activity')
      .insert({ trip_id: tripId, entity: 'stop', entity_id: tripId, action: 'created' })

    await db.from('trips').where('id', tripId).delete()

    assert.isEmpty(await db.from('stops').where('trip_id', tripId))
    assert.isEmpty(await db.from('emergency_info').where('trip_id', tripId))
    assert.isEmpty(await db.from('trip_activity').where('trip_id', tripId))
  })

  test('trip has exactly one owner', async ({ assert }) => {
    const owner = await insertUser('owner@example.com')
    const partner = await insertUser('partner@example.com')
    const tripId = await insertTrip(owner)
    await db.table('trip_members').insert({ trip_id: tripId, user_id: owner, role: 'owner' })

    assert.isFalse(
      await checkAccepts('trip_members', 'role', 'owner', { trip_id: tripId, user_id: partner })
    )
    assert.isTrue(
      await checkAccepts('trip_members', 'role', 'editor', { trip_id: tripId, user_id: partner })
    )
  })

  test('a removed member can be added again (partial unique on live rows)', async ({ assert }) => {
    const owner = await insertUser()
    const tripId = await insertTrip(owner)
    await db.table('trip_members').insert({
      trip_id: tripId,
      user_id: owner,
      role: 'editor',
      deleted_at: new Date(),
    })
    assert.isTrue(
      await checkAccepts('trip_members', 'role', 'editor', { trip_id: tripId, user_id: owner })
    )
    assert.isFalse(
      await checkAccepts('trip_members', 'role', 'editor', { trip_id: tripId, user_id: owner })
    )
  })

  test('deleting a user cascades to tokens, memberships and push subscriptions', async ({
    assert,
  }) => {
    const owner = await insertUser()
    const tripId = await insertTrip(owner)
    await db.table('trip_members').insert({ trip_id: tripId, user_id: owner, role: 'owner' })
    await db.table('user_tokens').insert({
      user_id: owner,
      purpose: 'verify_email',
      token_hash: 'h',
      expires_at: new Date(),
    })
    await db
      .table('push_subscriptions')
      .insert({ user_id: owner, endpoint: 'https://push.example.com/1', p256dh: 'k', auth: 'a' })

    await db.from('users').where('id', owner).delete()

    assert.isEmpty(await db.from('trip_members').where('user_id', owner))
    assert.isEmpty(await db.from('user_tokens').where('user_id', owner))
    assert.isEmpty(await db.from('push_subscriptions').where('user_id', owner))
    const [trip] = await db.from('trips').where('id', tripId)
    assert.isNull(trip.created_by)
  })
})
