import { test } from '@japa/runner'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import ace from '@adonisjs/core/services/ace'
import db from '@adonisjs/lucid/services/db'
import i18nManager from '@adonisjs/i18n/services/main'
import type { TripJsonV1 } from '@monkitrips/shared'
import { validateTripJson } from '#services/trip_json_schema'
import { makeUser } from '#tests/helpers/make_user'
import { makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { mutation, pushApplied } from '#tests/helpers/sync'

const DIR = app.tmpPath('trip-json-commands')

test.group('Trip JSON commands', (group) => {
  useFixedClock(group, new Date('2026-11-07T10:00:00Z'))
  group.setup(async () => {
    await mkdir(DIR, { recursive: true })
    return () => rm(DIR, { recursive: true, force: true })
  })
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('trip export writes the document of a live trip', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner, { name: 'Written out' })
    await pushApplied(client, owner, mutation(trip.id, 'stop', { name: 'Harbour Town' }))
    const file = join(DIR, 'written-out.json')

    const command = await ace.exec('trip:export', [trip.id, file])

    command.assertSucceeded()
    command.assertLogMatches(/wrote .*written-out\.json: 1 stops, 0 events/)
    const document: TripJsonV1 = JSON.parse(await readFile(file, 'utf8'))
    assert.equal(document.trip.name, 'Written out')
    assert.deepEqual(validateTripJson(document, i18nManager.locale('en')), [])
  })

  test('trip export fails for an unknown or deleted trip', async ({ assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    trip.deletedAt = trip.createdAt
    await trip.save()
    const file = join(DIR, 'never.json')

    const command = await ace.exec('trip:export', [trip.id, file])

    command.assertFailed()
    command.assertLogMatches(/no live trip has that id/)
    await assert.rejects(() => readFile(file))
  })

  test('trip import with --dry-run reports the summary and writes nothing', async ({ assert }) => {
    const owner = await makeUser({ email: 'importer@example.com' })
    const file = join(DIR, 'dry.json')
    await writeFile(
      file,
      await readFile(app.makePath('tests/fixtures/trip-json-v1/demo-loop.json'))
    )

    const command = await ace.exec('trip:import', [
      file,
      '--user',
      'Importer@example.com',
      '--dry-run',
    ])

    command.assertSucceeded()
    command.assertLogMatches(/Demo Loop \(2027-01-20 to 2027-02-06\): 3 stops, 4 events/)
    command.assertLogMatches(/dry run: nothing was written/)
    assert.isEmpty(await db.from('trips').where('created_by', owner.id))
  })

  test('trip import creates the trip for the account and reports its id', async ({
    assert,
    db: dbAssert,
  }) => {
    const owner = await makeUser({ email: 'owner-cli@example.com' })
    const file = join(DIR, 'real.json')
    await writeFile(
      file,
      await readFile(app.makePath('tests/fixtures/trip-json-v1/demo-loop.json'))
    )

    const command = await ace.exec('trip:import', [file, '--user', owner.email])

    command.assertSucceeded()
    command.assertLogMatches(/imported as trip [0-9a-f-]{36}/)
    const [trip] = await db.from('trips').where('created_by', owner.id)
    assert.equal(trip.name, 'Demo Loop')
    await dbAssert.assertHas('trip_members', { trip_id: trip.id, user_id: owner.id, role: 'owner' })
    assert.lengthOf(await db.from('events').where('trip_id', trip.id), 4)
  })

  test('trip import refuses a bad file, listing each problem, and an unknown account', async ({
    assert,
  }) => {
    const owner = await makeUser({ email: 'careful@example.com' })
    const file = join(DIR, 'bad.json')
    const document = JSON.parse(
      await readFile(app.makePath('tests/fixtures/trip-json-v1/demo-loop.json'), 'utf8')
    )
    document.events[0].stopRef = 'stop-9'
    await writeFile(file, JSON.stringify(document))

    const refused = await ace.exec('trip:import', [file, '--user', owner.email])
    refused.assertFailed()
    refused.assertLogMatches(/events\[0\]\.stopRef: /)
    refused.assertLogMatches(/nothing was written/)
    assert.isEmpty(await db.from('trips').where('created_by', owner.id))

    const nobody = await ace.exec('trip:import', [file, '--user', 'nobody@example.com'])
    nobody.assertFailed()
    nobody.assertLogMatches(/no account matches --user/)
  })
})
