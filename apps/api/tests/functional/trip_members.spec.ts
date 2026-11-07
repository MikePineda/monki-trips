import { test } from '@japa/runner'
import { actingAs } from '#tests/helpers/acting_as'
import { expectStatus } from '#tests/helpers/expect_status'
import { makeUser } from '#tests/helpers/make_user'
import { addMember, makeInvitation, makeTrip } from '#tests/helpers/make_trip'
import TripMember from '#models/trip_member'

async function ownerMembership(tripId: string, userId: string) {
  return TripMember.query().where('trip_id', tripId).where('user_id', userId).firstOrFail()
}

test.group('Trip members', () => {
  test('every member lists the members, owner first', async ({ client, assert }) => {
    const owner = await makeUser({ displayName: 'Owner' })
    const editor = await makeUser({ displayName: 'Editor' })
    const trip = await makeTrip(owner)
    await addMember(trip, editor)

    const response = await actingAs(client.get(`/api/v1/trips/${trip.id}/members`), editor)

    response.assertStatus(200)
    assert.deepEqual(
      response
        .body()
        .data.map((m: { displayName: string; role: string }) => [m.displayName, m.role]),
      [
        ['Owner', 'owner'],
        ['Editor', 'editor'],
      ]
    )
  })

  test('owner cannot leave the trip', async ({ client, db }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const membership = await ownerMembership(trip.id, owner.id)

    const response = await actingAs(
      client.delete(`/api/v1/trips/${trip.id}/members/${membership.id}`),
      owner
    )

    response.assertStatus(409)
    response.assertBodyContains({ code: 'E_OWNER_CANNOT_LEAVE' })
    await db.assertHas('trip_members', { id: membership.id, deleted_at: null })
  })

  test('the owner removes an editor, who then sees no trip', async ({ client, assert }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    const membership = await addMember(trip, editor)

    const response = await actingAs(
      client.delete(`/api/v1/trips/${trip.id}/members/${membership.id}`),
      owner
    )

    response.assertStatus(204)
    await membership.refresh()
    assert.isNotNull(membership.deletedAt, 'removal is a soft delete (sync tombstone)')
    const gone = await actingAs(client.get(`/api/v1/trips/${trip.id}/snapshot`), editor)
    gone.assertStatus(404)
  })

  test('an editor leaves the trip by removing their own membership', async ({ client }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    const membership = await addMember(trip, editor)

    const response = await actingAs(
      client.delete(`/api/v1/trips/${trip.id}/members/${membership.id}`),
      editor
    )

    response.assertStatus(204)
  })

  test('an editor cannot remove anyone else', async ({ client, db }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const other = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, editor)
    const otherMembership = await addMember(trip, other)

    const response = await actingAs(
      client.delete(`/api/v1/trips/${trip.id}/members/${otherMembership.id}`),
      editor
    )

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_TRIP_ROLE' })
    await db.assertHas('trip_members', { id: otherMembership.id, deleted_at: null })
  })

  test('a member of another trip answers 404', async ({ client }) => {
    const owner = await makeUser()
    const otherOwner = await makeUser()
    const trip = await makeTrip(owner)
    const otherTrip = await makeTrip(otherOwner)
    const foreign = await ownerMembership(otherTrip.id, otherOwner.id)

    const response = await actingAs(
      client.delete(`/api/v1/trips/${trip.id}/members/${foreign.id}`),
      owner
    )

    response.assertStatus(404)
  })

  test('the owner may set an editor role but never demote the owner row', async ({ client }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    const editorMembership = await addMember(trip, editor)
    const ownerRow = await ownerMembership(trip.id, owner.id)

    const keep = await actingAs(
      client.patch(`/api/v1/trips/${trip.id}/members/${editorMembership.id}`),
      owner
    ).json({ role: 'editor' })
    keep.assertStatus(200)

    const promote = await actingAs(
      client.patch(`/api/v1/trips/${trip.id}/members/${editorMembership.id}`),
      owner
    ).json({ role: 'owner' })
    promote.assertStatus(409)
    promote.assertBodyContains({ code: 'E_OWNER_CANNOT_LEAVE' })

    const demote = await actingAs(
      client.patch(`/api/v1/trips/${trip.id}/members/${ownerRow.id}`),
      owner
    ).json({ role: 'editor' })
    demote.assertStatus(409)

    const byEditor = await actingAs(
      client.patch(`/api/v1/trips/${trip.id}/members/${editorMembership.id}`),
      editor
    ).json({ role: 'editor' })
    byEditor.assertStatus(403)
  })

  test('a removed member can be invited back and gets a fresh membership', async ({
    client,
    db,
  }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    const membership = await addMember(trip, editor)
    await expectStatus(
      actingAs(client.delete(`/api/v1/trips/${trip.id}/members/${membership.id}`), owner),
      204
    )

    const { token } = await makeInvitation(trip, owner)
    const accept = await actingAs(client.post(`/api/v1/invitations/${token}/accept`), editor)

    accept.assertStatus(201)
    await db.assertHas('trip_members', { trip_id: trip.id, user_id: editor.id, deleted_at: null })
    await db.assertHas('travellers', { trip_id: trip.id, user_id: editor.id, deleted_at: null }, 1)
  })
})
