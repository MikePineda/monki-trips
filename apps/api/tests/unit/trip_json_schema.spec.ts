import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import i18nManager from '@adonisjs/i18n/services/main'
import {
  DOCUMENT_KINDS,
  DOCUMENT_TAGS,
  EVENT_KINDS,
  EVENT_STATUSES,
  FX_SOURCES,
  TASK_ORIGINS,
  TASK_PRIORITIES,
  TRIP_JSON_VERSION,
} from '@monkitrips/shared'
import { tripJsonSchema, validateTripJson } from '#services/trip_json_schema'

async function fixture(): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(app.makePath('tests/fixtures/trip-json-v1/demo-loop.json'), 'utf8')
  )
}

test.group('Trip JSON v1 schema', () => {
  const i18n = () => i18nManager.locale('en')

  test('the synthetic demo loop file is a valid document', async ({ assert }) => {
    assert.deepEqual(validateTripJson(await fixture(), i18n()), [])
  })

  test('a minimal hand-written file needs only the version and the trip', ({ assert }) => {
    const problems = validateTripJson(
      {
        version: TRIP_JSON_VERSION,
        trip: {
          name: 'Weekend',
          baseCurrency: 'EUR',
          startsOn: '2027-03-05',
          endsOn: '2027-03-07',
        },
      },
      i18n()
    )
    assert.deepEqual(problems, [])
  })

  test('problems are reported per field in the validator wording', async ({ assert }) => {
    const document = await fixture()
    const events = document['events'] as Record<string, unknown>[]
    events[0]['kind'] = 'rocket'
    events[1]['startsLocal'] = '2027-01-20 20:00'
    delete events[2]['title']
    document['version'] = 'trip-json-v2'

    const problems = validateTripJson(document, i18n())

    assert.sameDeepMembers(
      problems.map(({ field, rule }) => [field, rule]),
      [
        ['version', 'enum'],
        ['events[0].kind', 'enum'],
        ['events[1].startsLocal', 'regex'],
        ['events[2].title', 'required'],
      ]
    )
    assert.include(
      problems.find((p) => p.field === 'events[2].title')!.message,
      'title is required'
    )
  })

  test('the schema enums mirror the shared constants', ({ assert }) => {
    const schema = tripJsonSchema() as {
      properties: { version: { const: string } }
      $defs: Record<
        string,
        { properties: Record<string, { enum?: unknown[]; items?: { enum?: unknown[] } }> }
      >
    }
    assert.equal(schema.properties.version.const, TRIP_JSON_VERSION)
    assert.deepEqual(schema.$defs['event'].properties['kind'].enum, [...EVENT_KINDS])
    assert.deepEqual(schema.$defs['event'].properties['status'].enum, [...EVENT_STATUSES])
    assert.deepEqual(schema.$defs['document'].properties['kind'].enum, [...DOCUMENT_KINDS])
    assert.deepEqual(schema.$defs['document'].properties['tags'].items?.enum, [...DOCUMENT_TAGS])
    assert.deepEqual(schema.$defs['task'].properties['priority'].enum, [...TASK_PRIORITIES])
    assert.deepEqual(schema.$defs['task'].properties['origin'].enum, [...TASK_ORIGINS])
    assert.deepEqual(schema.$defs['expense'].properties['fxSource'].enum, [...FX_SOURCES, null])
  })
})
