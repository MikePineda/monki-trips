import db from '@adonisjs/lucid/services/db'

/** A slot this worker won: the `scheduler_runs` row to finish. */
export interface ClaimedRun {
  id: number
  job: string
  runKey: string
}

/**
 * Who runs a slot. Two containers coexist during a start-first update and
 * both tick, so the claim is made in SQL, in one short transaction:
 *
 * 1. `pg_try_advisory_xact_lock(hashtext(job))`: if another worker holds the
 *    job right now, give up without waiting (the lock ends with the
 *    transaction, so a crashed worker never keeps it).
 * 2. `INSERT ... ON CONFLICT DO NOTHING` on `UNIQUE (job, run_key)`: if the
 *    slot already ran (or is running), nobody wins it again.
 *
 * The unique row is the durable guarantee; the advisory lock only spares
 * two workers the same insert at the same instant.
 */
export class JobClaim {
  async claim(job: string, runKey: string): Promise<ClaimedRun | null> {
    return db.transaction(async (trx) => {
      const lock = await trx.rawQuery<{ rows: { locked: boolean }[] }>(
        'select pg_try_advisory_xact_lock(hashtext(?)) as locked',
        [job]
      )
      if (!lock.rows[0]?.locked) return null
      const inserted = await trx.rawQuery<{ rows: { id: number }[] }>(
        `insert into scheduler_runs (job, run_key, status)
         values (?, ?, 'running')
         on conflict (job, run_key) do nothing
         returning id`,
        [job, runKey]
      )
      const row = inserted.rows[0]
      return row ? { id: Number(row.id), job, runKey } : null
    })
  }

  async finish(run: ClaimedRun, status: 'done' | 'failed', finishedAt: Date): Promise<void> {
    await db
      .from('scheduler_runs')
      .where('id', run.id)
      .update({ status, finished_at: finishedAt.toISOString() })
  }
}
