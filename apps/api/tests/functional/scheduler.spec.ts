import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import type { Clock } from '#services/clock'
import { JobClaim } from '#services/scheduler/job_claim'
import { Scheduler } from '#services/scheduler/scheduler'
import type { ScheduledJob } from '#services/scheduler/scheduled_job'
import { useFixedClock } from '#tests/helpers/fixed_clock'

/** A job that counts its runs and can be told to fail. */
class CountingJob implements ScheduledJob {
  runs = 0
  failWith: Error | null = null

  constructor(
    readonly name: string,
    readonly interval: 'minute' | 'hour' | 'day' = 'hour'
  ) {}

  async run(): Promise<void> {
    this.runs += 1
    if (this.failWith) throw this.failWith
  }
}

async function worker(clock: Clock): Promise<Scheduler> {
  const logger = await app.container.make('logger')
  return new Scheduler(new JobClaim(), clock, logger)
}

test.group('Scheduler', (group) => {
  const clock = useFixedClock(group, new Date('2026-11-07T10:15:00Z'))

  test('scheduler runs a job once across two concurrent workers', async ({ assert, db }) => {
    const job = new CountingJob('spec:count')
    const [a, b] = [await worker(clock), await worker(clock)]
    a.register(job)
    b.register(job)

    const outcomes = await Promise.all([a.runDue(), b.runDue()])

    assert.lengthOf(outcomes, 2)
    assert.equal(job.runs, 1)
    await db.assertCount('scheduler_runs', 1)
    await db.assertHas('scheduler_runs', {
      job: 'spec:count',
      run_key: '2026-11-07T10:00Z',
      status: 'done',
    })
  })

  test('the next slot runs again, the same slot never twice', async ({ assert, db }) => {
    const job = new CountingJob('spec:slots', 'hour')
    const scheduler = await worker(clock)
    scheduler.register(job)

    await scheduler.runDue()
    clock.advance(30 * 60_000)
    await scheduler.runDue()
    assert.equal(job.runs, 1)

    clock.advance(30 * 60_000)
    await scheduler.runDue()

    assert.equal(job.runs, 2)
    await db.assertCount('scheduler_runs', 2)
  })

  test('a job that throws is recorded as failed and does not stop the others', async ({
    assert,
    db,
  }) => {
    const broken = new CountingJob('spec:broken')
    broken.failWith = new Error('boom')
    const healthy = new CountingJob('spec:healthy')
    const scheduler = await worker(clock)
    scheduler.register(broken)
    scheduler.register(healthy)

    await scheduler.runDue()

    assert.equal(healthy.runs, 1)
    await db.assertHas('scheduler_runs', { job: 'spec:broken', status: 'failed' })
    await db.assertHas('scheduler_runs', { job: 'spec:healthy', status: 'done' })
  })

  test('the container scheduler registers push:prune first and is idle under test', async ({
    assert,
  }) => {
    const scheduler = await app.container.make(Scheduler)

    assert.deepEqual(scheduler.jobNames, ['push:prune'])
    assert.isFalse(scheduler.running)
  })

  test('registering a job name twice is refused', async ({ assert }) => {
    const scheduler = await worker(clock)
    scheduler.register(new CountingJob('spec:twice'))

    assert.throws(() => scheduler.register(new CountingJob('spec:twice')), /already registered/)
  })
})
