import { test } from '@japa/runner'
import { signupGate } from '#domain/signup_gate'

test.group('Signup gate', () => {
  test('open registration lets anyone in without an invitation', ({ assert }) => {
    assert.deepEqual(signupGate({ registrationOpen: true, email: 'a@example.com' }), {
      allowed: true,
      viaInvitation: false,
      emailVerifiedByInvitation: false,
    })
  })

  test('closed registration refuses a signup without an invitation', ({ assert }) => {
    assert.deepEqual(signupGate({ registrationOpen: false, email: 'a@example.com' }), {
      allowed: false,
      code: 'E_REGISTRATION_CLOSED',
    })
  })

  test('a pending invitation by link lets someone in while registration is closed', ({
    assert,
  }) => {
    assert.deepEqual(
      signupGate({
        registrationOpen: false,
        email: 'a@example.com',
        invitation: { state: 'pending', email: null },
      }),
      { allowed: true, viaInvitation: true, emailVerifiedByInvitation: false }
    )
  })

  test('an invitation by e-mail requires the same address and proves it', ({ assert }) => {
    const invitation = { state: 'pending' as const, email: 'partner@example.com' }
    assert.deepEqual(
      signupGate({ registrationOpen: false, email: 'partner@example.com', invitation }),
      { allowed: true, viaInvitation: true, emailVerifiedByInvitation: true }
    )
    assert.deepEqual(
      signupGate({ registrationOpen: false, email: 'other@example.com', invitation }),
      { allowed: false, code: 'E_INVITATION_EMAIL_MISMATCH' }
    )
  })

  test('an expired, accepted, revoked or unknown invitation answers expired', ({ assert }) => {
    for (const state of ['expired', 'accepted', 'revoked'] as const) {
      assert.deepEqual(
        signupGate({
          registrationOpen: true,
          email: 'a@example.com',
          invitation: { state, email: null },
        }),
        { allowed: false, code: 'E_INVITATION_EXPIRED' }
      )
    }
    assert.deepEqual(
      signupGate({ registrationOpen: true, email: 'a@example.com', unknownInvitation: true }),
      { allowed: false, code: 'E_INVITATION_EXPIRED' }
    )
  })
})
