import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

/**
 * The 0000 migration ships `sync_stamp()` and `sync_change_seq` for every
 * syncable table to come. A throwaway table (rolled back with the test's
 * global transaction) proves the trigger contract.
 */
async function probeTable() {
  await db.rawQuery(`
    create table sync_probe (
      id int primary key,
      title text,
      change_xid xid8,
      change_seq bigint,
      updated_at timestamptz
    )
  `)
  await db.rawQuery(`
    create trigger sync_probe_stamp before insert or update on sync_probe
    for each row execute function sync_stamp()
  `)
}

async function probeRow() {
  const { rows } = await db.rawQuery(
    `select change_xid::text as xid, change_seq, updated_at,
            pg_current_xact_id()::text as current_xid
     from sync_probe where id = 1`
  )
  return rows[0]
}

test.group('Sync infrastructure', () => {
  test('sync_stamp stamps the transaction id, sequence and updated_at on insert', async ({
    assert,
  }) => {
    await probeTable()
    await db.rawQuery(`insert into sync_probe (id, title) values (1, 'first')`)

    const row = await probeRow()
    assert.equal(row.xid, row.current_xid)
    assert.isNotNull(row.change_seq)
    assert.instanceOf(row.updated_at, Date)
  })

  test('every update takes a later sequence value', async ({ assert }) => {
    await probeTable()
    await db.rawQuery(`insert into sync_probe (id, title) values (1, 'first')`)
    const before = await probeRow()

    await db.rawQuery(`update sync_probe set title = 'second' where id = 1`)
    const after = await probeRow()

    assert.isAbove(Number(after.change_seq), Number(before.change_seq))
  })

  test('the client cannot choose its own stamp', async ({ assert }) => {
    await probeTable()
    await db.rawQuery(
      `insert into sync_probe (id, title, change_seq, updated_at)
       values (1, 'forged', -1, '2000-01-01T00:00:00Z')`
    )

    const row = await probeRow()
    assert.isAbove(Number(row.change_seq), 0)
    assert.isAbove(new Date(row.updated_at).getFullYear(), 2000)
  })
})
