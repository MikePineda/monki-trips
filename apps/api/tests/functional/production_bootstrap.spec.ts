import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import User from '#models/user'
import { ProductionBootstrap } from '#services/production_bootstrap'

const INPUT = {
  owner: { email: 'Owner@Example.com', password: 'owner-passphrase-long' },
  partner: { email: 'partner@example.com', password: 'partner-passphrase-long' },
  locale: 'es' as const,
}

test.group('Production bootstrap', () => {
  test('creates the owner and the partner verified, on the pro plan, in the seed locale', async ({
    db,
    assert,
  }) => {
    const bootstrap = await app.container.make(ProductionBootstrap)

    const result = await bootstrap.run(INPUT)

    assert.deepEqual(result, { created: ['owner', 'partner'], skipped: [] })
    await db.assertCount('users', 2)
    const owner = await User.findByOrFail('email', 'owner@example.com')
    assert.equal(owner.plan, 'pro')
    assert.equal(owner.locale, 'es')
    assert.isNotNull(owner.emailVerifiedAt)
    assert.notEqual(owner.password, INPUT.owner.password, 'the password is hashed')
    await User.verifyCredentials('owner@example.com', INPUT.owner.password)
    await User.verifyCredentials('partner@example.com', INPUT.partner.password)
    await db.assertCount('trips', 0)
  })

  test('production bootstrap is idempotent', async ({ db, assert }) => {
    const bootstrap = await app.container.make(ProductionBootstrap)
    await bootstrap.run(INPUT)
    const owner = await User.findByOrFail('email', 'owner@example.com')
    owner.displayName = 'Renamed by the owner'
    await owner.save()

    const result = await bootstrap.run({
      ...INPUT,
      owner: { ...INPUT.owner, password: 'a-different-passphrase' },
    })

    assert.deepEqual(result, { created: [], skipped: ['owner', 'partner'] })
    await db.assertCount('users', 2)
    await owner.refresh()
    assert.equal(owner.displayName, 'Renamed by the owner')
    await User.verifyCredentials('owner@example.com', INPUT.owner.password)
  })

  test('the partner is optional', async ({ db, assert }) => {
    const bootstrap = await app.container.make(ProductionBootstrap)

    const result = await bootstrap.run({ owner: INPUT.owner, locale: 'en' })

    assert.deepEqual(result, { created: ['owner'], skipped: [] })
    await db.assertCount('users', 1)
  })
})
