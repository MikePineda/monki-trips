import { test } from '@japa/runner'
import { deletionDate, soleOwnedSharedTrips } from '#domain/account_deletion'

test.group('Account deletion', () => {
  test('the hard delete is scheduled thirty days out', ({ assert }) => {
    assert.deepEqual(deletionDate(new Date('2026-11-07T10:00:00Z')), new Date('2026-12-07T10:00:00Z'))
  })

  test('owned trips with other members block the deletion, solo and edited trips do not', ({
    assert,
  }) => {
    assert.deepEqual(
      soleOwnedSharedTrips([
        { tripId: 'shared', role: 'owner', otherMemberCount: 1 },
        { tripId: 'solo', role: 'owner', otherMemberCount: 0 },
        { tripId: 'edited', role: 'editor', otherMemberCount: 3 },
      ]),
      ['shared']
    )
  })
})
