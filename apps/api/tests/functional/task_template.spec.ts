import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { ApiResponse } from '@japa/api-client'
import { PRE_TRIP_TEMPLATE_KEYS, type TripTaskRow } from '@monkitrips/shared'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { addMember, makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { mutation, push, pushApplied, pushOne } from '#tests/helpers/sync'

/** `POST /trips/:tripId/tasks/from-template` as `user`. */
async function fromTemplate(client: any, user: any, tripId: string): Promise<ApiResponse> {
  return actingAs(client.post(`/api/v1/trips/${tripId}/tasks/from-template`), user)
}

test.group('Tasks from template', (group) => {
  useFixedClock(group, new Date('2026-11-07T10:00:00Z'))

  test('template request is idempotent', async ({ client, db: dbAssert, assert }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner, { startsOn: '2027-01-20', endsOn: '2027-02-06' })
    await addMember(trip, editor)

    const first = await fromTemplate(client, editor, trip.id)
    const again = await fromTemplate(client, editor, trip.id)

    first.assertStatus(200)
    const firstBody = first.body().data as { tasks: TripTaskRow[]; created: number }
    assert.equal(firstBody.created, PRE_TRIP_TEMPLATE_KEYS.length)
    assert.deepEqual(
      firstBody.tasks.map((task) => task.templateItemKey),
      [...PRE_TRIP_TEMPLATE_KEYS]
    )
    const passport = firstBody.tasks.find((task) => task.templateItemKey === 'documents.passport')!
    assert.include(passport, {
      tripId: trip.id,
      origin: 'template',
      titleKey: 'template.documents.passport',
      title: 'Check the passport is valid 6+ months after the trip',
      priority: 'high',
      dueOn: '2026-11-21',
      doneAt: null,
      deletedAt: null,
    })
    const print = firstBody.tasks.find((task) => task.templateItemKey === 'before_leaving.print')!
    assert.equal(print.dueOn, '2027-01-19')
    assert.equal(print.titleKey, 'template.before_leaving.print')

    again.assertStatus(200)
    const againBody = again.body().data as { tasks: TripTaskRow[]; created: number }
    assert.equal(againBody.created, 0)
    assert.deepEqual(
      againBody.tasks.map((task) => task.id),
      firstBody.tasks.map((task) => task.id)
    )
    await dbAssert.assertCount('tasks', PRE_TRIP_TEMPLATE_KEYS.length)
    const activity = await db
      .from('trip_activity')
      .where('trip_id', trip.id)
      .where('entity', 'task')
      .where('action', 'created')
    assert.lengthOf(activity, PRE_TRIP_TEMPLATE_KEYS.length)
    assert.equal(activity[0].actor_user_id, editor.id)
  })

  test('the title follows the request locale while the key stays the same', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const response = await actingAs(
      client.post(`/api/v1/trips/${trip.id}/tasks/from-template`).header('Accept-Language', 'es'),
      owner
    )

    response.assertStatus(200)
    const cash = (response.body().data.tasks as TripTaskRow[]).find(
      (task) => task.templateItemKey === 'gear.cash'
    )!
    assert.equal(cash.titleKey, 'template.gear.cash')
    assert.equal(cash.title, 'Conseguir algo de efectivo local')
  })

  test('an item made offline is kept and only the missing ones are created', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner, { startsOn: '2027-01-20', endsOn: '2027-02-06' })
    const offline = mutation(trip.id, 'task', {
      title: 'Get some local cash',
      titleKey: 'template.gear.cash',
      origin: 'template',
      templateItemKey: 'gear.cash',
      priority: 'normal',
      dueOn: '2027-01-17',
    })
    const pushed = await pushApplied<TripTaskRow>(client, owner, offline)
    assert.include(pushed, {
      origin: 'template',
      templateItemKey: 'gear.cash',
      titleKey: 'template.gear.cash',
    })

    const response = await fromTemplate(client, owner, trip.id)

    response.assertStatus(200)
    const body = response.body().data as { tasks: TripTaskRow[]; created: number }
    assert.equal(body.created, PRE_TRIP_TEMPLATE_KEYS.length - 1)
    assert.lengthOf(body.tasks, PRE_TRIP_TEMPLATE_KEYS.length)
    assert.equal(body.tasks.find((task) => task.templateItemKey === 'gear.cash')?.id, offline.id)
  })

  test('offline template task reconciles on sync without failing the batch', async ({
    client,
    db: dbAssert,
    assert,
  }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, editor)
    const created = await fromTemplate(client, owner, trip.id)
    const serverRow = (created.body().data.tasks as TripTaskRow[]).find(
      (task) => task.templateItemKey === 'gear.esim'
    )!

    // The editor added the whole checklist on a plane; one item collides, the next mutation must still apply.
    const offlineItem = mutation(trip.id, 'task', {
      title: 'Get an eSIM or local SIM',
      titleKey: 'template.gear.esim',
      origin: 'template',
      templateItemKey: 'gear.esim',
      priority: 'normal',
      dueOn: '2027-01-13',
    })
    const offlineStop = mutation(trip.id, 'stop', { name: 'Harbour Town' })
    const [item, stop] = await push(client, editor, [offlineItem, offlineStop])

    assert.equal(item.status, 'duplicate')
    assert.equal((item.row as TripTaskRow).id, serverRow.id)
    assert.equal((item.row as TripTaskRow).templateItemKey, 'gear.esim')
    assert.equal(stop.status, 'applied')
    await dbAssert.assertMissing('tasks', { id: offlineItem.id })
    await dbAssert.assertCount('tasks', PRE_TRIP_TEMPLATE_KEYS.length)
    await dbAssert.assertHas('stops', { id: offlineStop.id })
  })

  test('client cannot set document or ai origin', async ({ client, db: dbAssert, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const asDocument = await pushOne(
      client,
      owner,
      mutation(trip.id, 'task', { title: 'Print it', origin: 'document' })
    )
    const asAi = await pushOne(
      client,
      owner,
      mutation(trip.id, 'task', { title: 'x', origin: 'ai' })
    )
    const keyWithoutTemplate = await pushOne(
      client,
      owner,
      mutation(trip.id, 'task', { title: 'x', templateItemKey: 'gear.cash' })
    )
    const titleKeyOnManual = await pushOne(
      client,
      owner,
      mutation(trip.id, 'task', { title: 'x', origin: 'manual', titleKey: 'template.gear.cash' })
    )
    const templateWithoutKey = await pushOne(
      client,
      owner,
      mutation(trip.id, 'task', { title: 'x', origin: 'template' })
    )
    const unknownKey = await pushOne(
      client,
      owner,
      mutation(trip.id, 'task', { title: 'x', origin: 'template', templateItemKey: 'gear.drone' })
    )

    for (const [result, field, rule] of [
      [asDocument, 'origin', 'enum'],
      [asAi, 'origin', 'enum'],
      [keyWithoutTemplate, 'templateItemKey', 'templateOnly'],
      [titleKeyOnManual, 'titleKey', 'templateOnly'],
      [templateWithoutKey, 'templateItemKey', 'required'],
      [unknownKey, 'templateItemKey', 'enum'],
    ] as const) {
      assert.equal(result.status, 'rejected', field)
      assert.equal(result.error?.code, 'E_VALIDATION_ERROR', field)
      assert.deepEqual(
        result.error?.errors?.map((error) => [error.field, error.rule]),
        [[field, rule]]
      )
    }
    await dbAssert.assertCount('tasks', 0)
  })

  test('origin and template key never change once a task exists', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const manual = mutation(trip.id, 'task', { title: 'Book the ferry' })
    await pushApplied(client, owner, manual)

    const promoted = await pushOne(client, owner, {
      ...manual,
      mutationId: randomUUID(),
      changes: { origin: 'template', templateItemKey: 'gear.cash', titleKey: 'template.gear.cash' },
    })
    const restated = await pushOne(client, owner, {
      ...manual,
      mutationId: randomUUID(),
      changes: { origin: 'manual', doneAt: '2026-11-07T09:00:00.000Z' },
    })

    assert.equal(promoted.status, 'rejected')
    assert.sameDeepMembers(
      promoted.error?.errors?.map((error) => [error.field, error.rule]) ?? [],
      [
        ['origin', 'immutable'],
        ['templateItemKey', 'immutable'],
        ['titleKey', 'immutable'],
      ]
    )
    assert.equal(restated.status, 'applied')
    assert.equal((restated.row as TripTaskRow).origin, 'manual')
    assert.equal((restated.row as TripTaskRow).doneBy, owner.id)
  })

  test('the template tasks of a deleted trip or a stranger are out of reach', async ({
    client,
  }) => {
    const owner = await makeUser()
    const stranger = await makeUser()
    const trip = await makeTrip(owner)

    const response = await fromTemplate(client, stranger, trip.id)

    response.assertStatus(404)
    response.assertBodyContains({ code: 'E_ROW_NOT_FOUND' })
  })
})
