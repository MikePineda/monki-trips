import { test } from '@japa/runner'
import { canManageTrip, memberRemoval, roleChange } from '#domain/trip_roles'

test.group('Trip roles', () => {
  test('only the owner manages the trip', ({ assert }) => {
    assert.isTrue(canManageTrip('owner'))
    assert.isFalse(canManageTrip('editor'))
  })

  test('owner cannot leave the trip', ({ assert }) => {
    assert.equal(
      memberRemoval({ actorRole: 'owner', targetRole: 'owner', actorIsTarget: true }),
      'E_OWNER_CANNOT_LEAVE'
    )
  })

  test('an editor may leave but not remove anyone else', ({ assert }) => {
    assert.equal(
      memberRemoval({ actorRole: 'editor', targetRole: 'editor', actorIsTarget: true }),
      'allowed'
    )
    assert.equal(
      memberRemoval({ actorRole: 'editor', targetRole: 'editor', actorIsTarget: false }),
      'E_TRIP_ROLE'
    )
  })

  test('the owner removes editors', ({ assert }) => {
    assert.equal(
      memberRemoval({ actorRole: 'owner', targetRole: 'editor', actorIsTarget: false }),
      'allowed'
    )
  })

  test('roles change only by the owner and never touch the owner row', ({ assert }) => {
    assert.equal(roleChange({ actorRole: 'editor', targetRole: 'editor', newRole: 'editor' }), 'E_TRIP_ROLE')
    assert.equal(
      roleChange({ actorRole: 'owner', targetRole: 'owner', newRole: 'editor' }),
      'E_OWNER_CANNOT_LEAVE'
    )
    assert.equal(
      roleChange({ actorRole: 'owner', targetRole: 'editor', newRole: 'owner' }),
      'E_OWNER_CANNOT_LEAVE'
    )
    assert.equal(roleChange({ actorRole: 'owner', targetRole: 'editor', newRole: 'editor' }), 'allowed')
  })
})
