import { test } from '@japa/runner'
import { rm } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import Trip from '#models/trip'
import { DemoTrip } from '#services/demo_trip'
import { TripViews } from '#services/trip_views'
import { makeUser } from '#tests/helpers/make_user'
import { useFixedClock } from '#tests/helpers/fixed_clock'

test.group('Demo trip seed', (group) => {
  useFixedClock(group, new Date('2026-11-07T10:00:00Z'))
  group.teardown(() => rm(app.tmpPath('drive'), { recursive: true, force: true }))

  test('seeds the demo loop with its nights, money, seats, documents and tasks, once', async ({
    assert,
  }) => {
    const owner = await makeUser({ email: 'demo-owner@example.com' })
    const partner = await makeUser({ email: 'demo-partner@example.com' })
    const demo = await app.container.make(DemoTrip)

    const first = await demo.seed({ ownerEmail: owner.email, partnerEmail: partner.email })
    const second = await demo.seed({ ownerEmail: owner.email, partnerEmail: partner.email })

    assert.isTrue(first.created)
    assert.isFalse(second.created)
    assert.equal(second.tripId, first.tripId)
    const trip = await Trip.findOrFail(first.tripId)
    const views = await app.container.make(TripViews)

    const nights = await views.nights(trip)
    assert.lengthOf(nights.nights, 17)
    assert.equal(nights.uncoveredCount, 1)
    assert.equal(nights.nights.find((night) => !night.covered)?.date, '2027-01-26')
    assert.equal(nights.nights.at(-1)?.coveredBy?.kind, 'flight')
    assert.equal(nights.nights.find((n) => n.date === '2027-01-27')?.coveredBy?.kind, 'train')

    const budget = await views.budget(trip)
    assert.equal(budget.pendingFxCount, 1)
    assert.equal(budget.spentMinor, 4000)

    assert.lengthOf(await db.from('segment_seats').where('trip_id', trip.id), 6)
    assert.lengthOf(await db.from('travellers').where('trip_id', trip.id), 3)
    const [voucher] = await db.from('documents').where('trip_id', trip.id).where('kind', 'file')
    assert.deepEqual(voucher.tags, ['print'])
    const tasks = await db.from('tasks').where('trip_id', trip.id).whereNull('deleted_at')
    assert.isTrue(tasks.some((task) => task.origin === 'document'))
    assert.isTrue(tasks.some((task) => task.priority === 'high'))
    assert.isTrue(tasks.some((task) => task.due_on && task.due_on < new Date('2026-11-07')))
  })
})
