import { test } from '@japa/runner'
import { UserAdministration } from '#services/user_administration'
import { actingAs } from '#tests/helpers/acting_as'
import { expectStatus } from '#tests/helpers/expect_status'
import { makeUser } from '#tests/helpers/make_user'

test.group('User administration (CLI)', () => {
  test('disabling an account signs it out everywhere; enabling lets it back in', async ({
    client,
    assert,
  }) => {
    const admin = new UserAdministration()
    const user = await makeUser({ email: 'owner@example.com' })
    const versionBefore = user.sessionVersion

    const found = await admin.findByEmail('Owner@Example.com')
    assert.equal(found?.id, user.id)
    await admin.setDisabled(found!, true)

    await user.refresh()
    assert.equal(user.status, 'disabled')
    assert.equal(user.sessionVersion, versionBefore + 1)
    const stale = await client
      .get('/api/v1/auth/me')
      .loginAs(user)
      .withSession({ auth_session_version: versionBefore })
    stale.assertStatus(401)

    await admin.setDisabled(user, false)
    await user.refresh()
    assert.equal(user.status, 'active')
    await expectStatus(actingAs(client.get('/api/v1/auth/me'), user), 200)
  })

  test('changing the plan touches nothing else', async ({ assert }) => {
    const admin = new UserAdministration()
    const user = await makeUser()

    await admin.setPlan(user, 'pro')

    await user.refresh()
    assert.equal(user.plan, 'pro')
    assert.equal(user.status, 'active')
    assert.equal(user.sessionVersion, 1)
  })
})
