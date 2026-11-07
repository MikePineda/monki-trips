import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import type { ApiResponse } from '@japa/api-client'
import type { EmergencyInfo } from '@monkitrips/shared'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { addMember, makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { mutation, pushApplied, pushOne } from '#tests/helpers/sync'

const insurer = { provider: 'Demo Insurance', policyNumber: 'POL-0000', phone: '0800 000 000' }
const contacts = [{ name: 'Local emergency number', phone: '000', note: null }]

test.group('Emergency info', (group) => {
  const clock = useFixedClock(group, new Date('2026-11-07T10:00:00Z'))

  test('get answers null until something is stored, then the document', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, editor)

    const empty: ApiResponse = await actingAs(
      client.get(`/api/v1/trips/${trip.id}/emergency`),
      editor
    )
    empty.assertStatus(200)
    assert.isNull(empty.body().data)

    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'emergency', { notes: 'Owner notes' }, { id: trip.id })
    )
    const stored: ApiResponse = await actingAs(
      client.get(`/api/v1/trips/${trip.id}/emergency`),
      editor
    )

    stored.assertStatus(200)
    const info = stored.body().data as EmergencyInfo
    assert.equal(info.tripId, trip.id)
    assert.equal(info.schemaVersion, 1)
    assert.deepEqual(info.content, { notes: 'Owner notes' })
    assert.isNull(info.deletedAt)
  })

  test('emergency put replaces the document and keeps per key clocks', async ({
    client,
    db: dbAssert,
    assert,
  }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, editor)
    await pushApplied(
      client,
      owner,
      mutation(
        trip.id,
        'emergency',
        { notes: 'Owner notes', insurance: insurer },
        { id: trip.id, changedAt: '2026-11-07T09:00:00.000Z' }
      )
    )

    const replaced: ApiResponse = await actingAs(
      client.put(`/api/v1/trips/${trip.id}/emergency`),
      editor
    ).json({ contacts, medical: { notes: 'No allergies' }, unknown: 'dropped' })

    replaced.assertStatus(200)
    const info = replaced.body().data as EmergencyInfo
    assert.equal(info.tripId, trip.id)
    assert.deepEqual(info.content, {
      contacts,
      insurance: null,
      embassy: null,
      medical: { notes: 'No allergies' },
      notes: null,
    })
    const [row] = await db.from('emergency_info').where('trip_id', trip.id)
    const putAt = Date.parse('2026-11-07T10:00:00.000Z')
    assert.deepEqual(row.field_clock, {
      contacts: putAt,
      insurance: putAt,
      embassy: putAt,
      medical: putAt,
      notes: putAt,
    })
    await dbAssert.assertHas('trip_activity', {
      trip_id: trip.id,
      actor_user_id: editor.id,
      entity: 'emergency',
      entity_id: trip.id,
      action: 'updated',
    })

    // An offline edit of the notes from before the replacement loses; one made after it wins.
    const stale = await pushOne(
      client,
      owner,
      mutation(
        trip.id,
        'emergency',
        { notes: 'Written on the plane' },
        { id: trip.id, changedAt: '2026-11-07T09:30:00.000Z' }
      )
    )
    clock.advance(120_000)
    const fresh = await pushOne(
      client,
      owner,
      mutation(
        trip.id,
        'emergency',
        { insurance: insurer },
        { id: trip.id, changedAt: '2026-11-07T10:01:00.000Z' }
      )
    )

    assert.equal(stale.status, 'partial')
    assert.deepEqual(stale.rejectedFields, ['notes'])
    assert.equal(fresh.status, 'applied')
    const shown: ApiResponse = await actingAs(
      client.get(`/api/v1/trips/${trip.id}/emergency`),
      owner
    )
    assert.deepEqual((shown.body().data as EmergencyInfo).content, {
      contacts,
      insurance: insurer,
      embassy: null,
      medical: { notes: 'No allergies' },
      notes: null,
    })
  })

  test('put creates the document for a trip that had none', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const response: ApiResponse = await actingAs(
      client.put(`/api/v1/trips/${trip.id}/emergency`),
      owner
    ).json({ notes: 'Pharmacy next to the hotel' })

    response.assertStatus(200)
    const info = response.body().data as EmergencyInfo
    assert.equal(info.schemaVersion, 1)
    assert.deepEqual(info.content, {
      contacts: null,
      insurance: null,
      embassy: null,
      medical: null,
      notes: 'Pharmacy next to the hotel',
    })
  })

  test('put refuses a document that does not fit the schema and writes nothing', async ({
    client,
    db: dbAssert,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const response: ApiResponse = await actingAs(
      client.put(`/api/v1/trips/${trip.id}/emergency`),
      owner
    ).json({ contacts: [{ name: 'No phone' }] })

    response.assertStatus(422)
    assert.isNotEmpty(response.body().errors)
    assert.include(response.body().errors[0].field, 'contacts')
    await dbAssert.assertMissing('emergency_info', { trip_id: trip.id })
  })
})
