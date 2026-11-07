import { test } from '@japa/runner'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { mutation, pushApplied } from '#tests/helpers/sync'

test.group('Today', (group) => {
  useFixedClock(group, new Date('2027-01-22T01:00:00Z'))

  test('today follows the stop zone and names the next event, where we sleep and the documents of the day', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner, {
      budgetTotalMinor: 180000,
      startsOn: '2027-01-20',
      endsOn: '2027-01-29',
    })
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'stop', {
        name: 'River City',
        tz: 'Asia/Bangkok',
        arriveOn: '2027-01-21',
        departOn: '2027-01-24',
      })
    )
    const hotel = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'event', {
        kind: 'lodging',
        title: 'Riverside Inn',
        status: 'booked',
        startsLocal: '2027-01-21T15:00',
        startTz: 'Asia/Bangkok',
        endsLocal: '2027-01-24T11:00',
        endTz: 'Asia/Bangkok',
      })
    )
    const temple = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'event', {
        kind: 'tour',
        title: 'Temple walk',
        startsLocal: '2027-01-22T10:00',
        startTz: 'Asia/Bangkok',
        travelMin: 20,
      })
    )
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'document', {
        kind: 'link',
        title: 'Tickets',
        url: 'https://example.com/t',
        eventId: temple.id,
        tags: ['show_on_phone'],
      })
    )
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'task', { title: 'Overdue', dueOn: '2027-01-20' })
    )

    const response = await actingAs(client.get(`/api/v1/trips/${trip.id}/today`), owner)

    response.assertStatus(200)
    const today = response.body().data
    assert.include(today, {
      at: '2027-01-22T01:00:00.000Z',
      tz: 'Asia/Bangkok',
      date: '2027-01-22',
    })
    assert.include(today.nextEvent, {
      eventId: temple.id,
      title: 'Temple walk',
      startsAt: '2027-01-22T03:00:00.000Z',
      // 15 min default buffer + 20 min travel
      leaveAt: '2027-01-22T02:25:00.000Z',
      countdownMs: 2 * 60 * 60 * 1000,
    })
    assert.deepEqual(today.sleepingAt, {
      eventId: hotel.id,
      kind: 'lodging',
      title: 'Riverside Inn',
    })
    assert.lengthOf(today.todayDocumentIds, 1)
    assert.deepEqual(
      today.tasks.map((t: { urgency: string }) => t.urgency),
      ['overdue']
    )
    // 180000 over 8 days left (22nd..29th) = 22500 a day, nothing spent today.
    assert.equal(today.leftTodayMinor, 22500)
  })

  test('the at parameter moves the view and must be an instant', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const later = await actingAs(client.get(`/api/v1/trips/${trip.id}/today`), owner).qs({
      at: '2027-02-01T12:00:00Z',
    })
    const bad = await actingAs(client.get(`/api/v1/trips/${trip.id}/today`), owner).qs({
      at: 'tomorrow',
    })

    later.assertStatus(200)
    assert.equal(later.body().data.date, '2027-02-01')
    bad.assertStatus(422)
  })
})
