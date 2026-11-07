import { test } from '@japa/runner'
import { invitationExpiry, invitationState } from '#domain/invitation_state'

const now = new Date('2026-11-07T10:00:00Z')
const days = (count: number) => new Date(now.getTime() + count * 24 * 60 * 60_000)

test.group('Invitation state', () => {
  test('an invitation expires seven days after it is created', ({ assert }) => {
    assert.deepEqual(invitationExpiry(now), days(7))
  })

  test('pending until the expiry instant, expired from then on', ({ assert }) => {
    const invitation = { expiresAt: days(7), acceptedAt: null, revokedAt: null }
    assert.equal(invitationState(invitation, now), 'pending')
    assert.equal(invitationState(invitation, days(6)), 'pending')
    assert.equal(invitationState(invitation, days(7)), 'expired')
  })

  test('accepted and revoked are terminal whatever the date', ({ assert }) => {
    assert.equal(
      invitationState({ expiresAt: days(7), acceptedAt: now, revokedAt: null }, days(30)),
      'accepted'
    )
    assert.equal(
      invitationState({ expiresAt: days(7), acceptedAt: null, revokedAt: now }, days(1)),
      'revoked'
    )
  })
})
