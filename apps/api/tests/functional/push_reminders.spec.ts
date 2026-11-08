import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import type { ApiClient } from '@japa/api-client'
import PushSubscription from '#models/push_subscription'
import type Trip from '#models/trip'
import type User from '#models/user'
import { Clock } from '#services/clock'
import { JobClaim } from '#services/scheduler/job_claim'
import { PushRemindersJob } from '#services/scheduler/push_reminders_job'
import { Scheduler } from '#services/scheduler/scheduler'
import { actingAs } from '#tests/helpers/acting_as'
import { useFakePushSender, withPushDisabled } from '#tests/helpers/fake_push'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { addMember, makeTrip } from '#tests/helpers/make_trip'
import { makeUser } from '#tests/helpers/make_user'
import { mutation, pushApplied } from '#tests/helpers/sync'

/**
 * Synthetic trip: a stop in Asia/Bangkok (+07:00) and a flight at 14:00
 * local on 2027-01-22 (07:00Z). With the 150 min flight buffer the member
 * must leave at 11:30 local, 04:30Z: the minute the job is driven at.
 */
const LEAVE_AT = new Date('2027-01-22T04:30:00Z')

let endpoints = 0

/** A push subscription of `user` stored directly (the HTTP flow has its own spec). */
async function subscribe(user: User): Promise<PushSubscription> {
  endpoints += 1
  return PushSubscription.create({
    userId: user.id,
    endpoint: `https://push.example.com/send/reminders-${endpoints}`,
    p256dh: 'p256dh-key',
    auth: 'auth-secret',
  })
}

async function tripWithFlight(
  client: ApiClient,
  owner: User
): Promise<{ trip: Trip; flight: string }> {
  const trip = await makeTrip(owner, { startsOn: '2027-01-20', endsOn: '2027-01-29' })
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
  const flight = await pushApplied<{ id: string }>(
    client,
    owner,
    mutation(trip.id, 'event', {
      kind: 'flight',
      title: 'Flight to Old Harbour',
      status: 'booked',
      startsLocal: '2027-01-22T14:00',
      startTz: 'Asia/Bangkok',
      endsLocal: '2027-01-22T16:00',
      endTz: 'Asia/Bangkok',
    })
  )
  return { trip, flight: flight.id }
}

async function job(): Promise<PushRemindersJob> {
  return app.container.make(PushRemindersJob)
}

/** One run of a fresh `push:reminders` job at `at`, the way a worker that won the slot runs it. */
async function runReminders(at: Date): Promise<void> {
  const reminders = await job()
  await reminders.run(at)
}

test.group('Push reminders job', (group) => {
  const push = useFakePushSender(group)
  const clock = useFixedClock(group, LEAVE_AT)

  test('a reminder is sent once across two scheduler workers', async ({ client, assert, db }) => {
    const owner = await makeUser({ locale: 'es' })
    const subscription = await subscribe(owner)
    const { trip, flight } = await tripWithFlight(client, owner)
    const logger = await app.container.make('logger')
    const clockOf = await app.container.make(Clock)
    const [a, b] = [
      new Scheduler(new JobClaim(), clockOf, logger),
      new Scheduler(new JobClaim(), clockOf, logger),
    ]
    a.register(await job())
    b.register(await job())

    await Promise.all([a.runDue(), b.runDue()])
    // Even a worker that ran the job outside the slot claim does not send it again.
    await Promise.all([runReminders(clock.now()), runReminders(clock.now())])

    assert.lengthOf(push.sent, 1)
    assert.deepEqual(push.sentTo(subscription.endpoint), [
      {
        title: 'Hora de salir: Flight to Old Harbour',
        body: 'Sale a las 14:00. Sal a las 11:30.',
        url: `/t/${trip.id}/plan/e/${flight}`,
        tag: `leave_at:${flight}`,
      },
    ])
    await db.assertCount('sent_reminders', 1)
    await db.assertHas('sent_reminders', {
      user_id: owner.id,
      trip_id: trip.id,
      kind: 'leave_at',
      ref_id: flight,
    })
  })

  test('a reminder up to fifteen minutes late is still sent, an older one is skipped', async ({
    client,
    assert,
    db,
  }) => {
    const owner = await makeUser()
    await subscribe(owner)
    await tripWithFlight(client, owner)

    await runReminders(new Date(LEAVE_AT.getTime() + 20 * 60_000))
    assert.lengthOf(push.sent, 0)
    await db.assertCount('sent_reminders', 0)

    await runReminders(new Date(LEAVE_AT.getTime() + 14 * 60_000))
    assert.lengthOf(push.sent, 1)
    assert.equal(push.sent[0]?.payload.title, 'Time to leave: Flight to Old Harbour')
  })

  test('a reminder is not sent before its minute', async ({ client, assert }) => {
    const owner = await makeUser()
    await subscribe(owner)
    await tripWithFlight(client, owner)

    await runReminders(new Date(LEAVE_AT.getTime() - 60_000))

    assert.lengthOf(push.sent, 0)
  })

  test('non members never get reminders of a trip', async ({ client, assert }) => {
    const owner = await makeUser()
    const outsider = await makeUser()
    const former = await makeUser()
    const ownerDevice = await subscribe(owner)
    const outsiderDevice = await subscribe(outsider)
    const formerDevice = await subscribe(former)
    const { trip } = await tripWithFlight(client, owner)
    const membership = await addMember(trip, former)
    membership.deletedAt = DateTime.fromJSDate(clock.now())
    await membership.save()

    await runReminders(clock.now())
    const upcoming = await actingAs(client.get('/api/v1/me/reminders/upcoming'), outsider)

    assert.lengthOf(push.sentTo(ownerDevice.endpoint), 1)
    assert.deepEqual(push.sentTo(outsiderDevice.endpoint), [])
    assert.deepEqual(push.sentTo(formerDevice.endpoint), [])
    upcoming.assertStatus(200)
    assert.deepEqual(upcoming.body().data, [])
  })

  test('a deleted trip sends nothing', async ({ client, assert }) => {
    const owner = await makeUser()
    await subscribe(owner)
    const { trip } = await tripWithFlight(client, owner)
    trip.deletedAt = DateTime.fromJSDate(clock.now())
    await trip.save()

    await runReminders(clock.now())

    assert.lengthOf(push.sent, 0)
  })

  test('every device of a member gets the reminder and a dead one is pruned', async ({
    client,
    assert,
    db,
  }) => {
    const owner = await makeUser()
    const phone = await subscribe(owner)
    const tablet = await subscribe(owner)
    await tripWithFlight(client, owner)
    push.answerWith(tablet.endpoint, 410)

    await runReminders(clock.now())

    assert.lengthOf(push.sentTo(phone.endpoint), 1)
    assert.lengthOf(push.sentTo(tablet.endpoint), 1)
    await db.assertMissing('push_subscriptions', { id: tablet.id })
    await db.assertHas('push_subscriptions', { id: phone.id })
  })

  test('without VAPID keys the job sends and records nothing', async ({ client, assert, db }) => {
    const owner = await makeUser()
    await subscribe(owner)
    await tripWithFlight(client, owner)

    await withPushDisabled(() => runReminders(clock.now()))

    assert.lengthOf(push.sent, 0)
    await db.assertCount('sent_reminders', 0)
  })

  test('the container scheduler registers push:reminders every minute', async ({ assert }) => {
    const scheduler = await app.container.make(Scheduler)
    const reminders = await job()

    assert.deepEqual(scheduler.jobNames, ['push:prune', 'push:reminders'])
    assert.equal(reminders.name, 'push:reminders')
    assert.equal(reminders.interval, 'minute')
  })
})

test.group('Notification settings', (group) => {
  const push = useFakePushSender(group)
  useFixedClock(group, LEAVE_AT)

  test('an account without saved settings gets every reminder and no quiet hours', async ({
    client,
  }) => {
    const user = await makeUser()

    const response = await actingAs(client.get('/api/v1/me/notification-settings'), user)

    response.assertStatus(200)
    response.assertBody({
      data: {
        leaveAt: true,
        checkOut: true,
        tasksDue: true,
        quietHoursStart: null,
        quietHoursEnd: null,
      },
    })
  })

  test('settings are per user', async ({ client, assert, db }) => {
    const owner = await makeUser()
    const partner = await makeUser()
    const ownerDevice = await subscribe(owner)
    const partnerDevice = await subscribe(partner)
    const { trip } = await tripWithFlight(client, owner)
    await addMember(trip, partner)
    const settings = {
      leaveAt: false,
      checkOut: true,
      tasksDue: false,
      quietHoursStart: '22:30',
      quietHoursEnd: '07:00',
    }

    const saved = await actingAs(client.put('/api/v1/me/notification-settings'), owner).json(
      settings
    )
    const ownerRead = await actingAs(client.get('/api/v1/me/notification-settings'), owner)
    const partnerRead = await actingAs(client.get('/api/v1/me/notification-settings'), partner)
    await runReminders(LEAVE_AT)

    saved.assertStatus(200)
    saved.assertBody({ data: settings })
    ownerRead.assertBody({ data: settings })
    assert.isTrue(partnerRead.body().data.leaveAt)
    assert.isNull(partnerRead.body().data.quietHoursStart)
    await db.assertHas('notification_settings', { user_id: owner.id, leave_at: false })
    await db.assertMissing('notification_settings', { user_id: partner.id })
    assert.deepEqual(push.sentTo(ownerDevice.endpoint), [])
    assert.lengthOf(push.sentTo(partnerDevice.endpoint), 1)
  })

  test('saving again replaces the settings', async ({ client, db }) => {
    const user = await makeUser()
    const first = { leaveAt: false, checkOut: false, tasksDue: false }
    const second = {
      leaveAt: true,
      checkOut: false,
      tasksDue: true,
      quietHoursStart: null,
      quietHoursEnd: null,
    }

    await actingAs(client.put('/api/v1/me/notification-settings'), user).json({
      ...first,
      quietHoursStart: '23:00',
      quietHoursEnd: '06:00',
    })
    const response = await actingAs(client.put('/api/v1/me/notification-settings'), user).json(
      second
    )

    response.assertStatus(200)
    response.assertBody({ data: second })
    await db.assertCount('notification_settings', 1)
    await db.assertHas('notification_settings', {
      user_id: user.id,
      check_out: false,
      quiet_hours_start: null,
    })
  })

  test('quiet hours must be HH:MM and come in pairs', async ({ client, assert }) => {
    const user = await makeUser()
    const base = { leaveAt: true, checkOut: true, tasksDue: true }
    const put = (body: Record<string, unknown>) =>
      actingAs(client.put('/api/v1/me/notification-settings'), user).json(body)

    const half = await put({ ...base, quietHoursStart: '22:00', quietHoursEnd: null })
    const missing = await put({ ...base, quietHoursStart: '22:00' })
    const late = await put({ ...base, quietHoursStart: '24:00', quietHoursEnd: '07:00' })
    const loose = await put({ ...base, quietHoursStart: '7:00', quietHoursEnd: '22:00' })
    const noFlag = await put({ leaveAt: true, checkOut: true })
    const edge = await put({ ...base, quietHoursStart: '00:00', quietHoursEnd: '23:59' })

    for (const response of [half, missing, late, loose, noFlag]) response.assertStatus(422)
    assert.equal(half.body().errors[0].rule, 'quietHoursPair')
    assert.equal(late.body().errors[0].field, 'quietHoursStart')
    edge.assertStatus(200)
  })

  test('notification settings need a signed-in account', async ({ client }) => {
    const read = await client.get('/api/v1/me/notification-settings')
    const upcoming = await client.get('/api/v1/me/reminders/upcoming')

    read.assertStatus(401)
    upcoming.assertStatus(401)
  })
})

test.group('Upcoming reminders', (group) => {
  useFakePushSender(group)
  useFixedClock(group, new Date('2027-01-22T00:00:00Z'))

  test('upcoming reminders list the next hours in the account locale without a device', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser({ locale: 'es' })
    const { trip, flight } = await tripWithFlight(client, owner)
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'task', { title: 'Buy ferry tickets', dueOn: '2027-01-22' })
    )

    const response = await actingAs(client.get('/api/v1/me/reminders/upcoming'), owner)

    response.assertStatus(200)
    assert.deepEqual(response.body().data, [
      {
        kind: 'tasks_due',
        tripId: trip.id,
        refId: `${trip.id}:2027-01-22`,
        // 09:00 in Asia/Bangkok.
        fireAt: '2027-01-22T02:00:00.000Z',
        title: '1 tarea para hoy',
        body: 'Demo Loop: Buy ferry tickets',
        url: `/t/${trip.id}/more/tasks`,
      },
      {
        kind: 'leave_at',
        tripId: trip.id,
        refId: flight,
        fireAt: '2027-01-22T04:30:00.000Z',
        title: 'Hora de salir: Flight to Old Harbour',
        body: 'Sale a las 14:00. Sal a las 11:30.',
        url: `/t/${trip.id}/plan/e/${flight}`,
      },
    ])
  })

  test('upcoming reminders follow the saved settings', async ({ client, assert }) => {
    const owner = await makeUser()
    await tripWithFlight(client, owner)
    await actingAs(client.put('/api/v1/me/notification-settings'), owner).json({
      leaveAt: false,
      checkOut: true,
      tasksDue: true,
      quietHoursStart: null,
      quietHoursEnd: null,
    })

    const response = await actingAs(client.get('/api/v1/me/reminders/upcoming'), owner)

    response.assertStatus(200)
    assert.deepEqual(response.body().data, [])
  })
})
