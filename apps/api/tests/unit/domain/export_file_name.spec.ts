import { test } from '@japa/runner'
import { tripExportFileName } from '#domain/export_file_name'

test.group('Trip export file name', () => {
  test('slugs the trip name and appends the export date', ({ assert }) => {
    assert.equal(
      tripExportFileName('Demo Loop', new Date('2026-11-07T10:00:00Z')),
      'trip-demo-loop-2026-11-07.json'
    )
  })

  test('strips accents, punctuation and length, and never yields an empty slug', ({ assert }) => {
    const at = new Date('2026-11-07T23:59:59Z')
    assert.equal(
      tripExportFileName('Año nuevo: ¡Río & playa!', at),
      'trip-ano-nuevo-rio-playa-2026-11-07.json'
    )
    assert.equal(tripExportFileName('🎒🎒', at), 'trip-trip-2026-11-07.json')
    assert.equal(tripExportFileName('a'.repeat(80), at), `trip-${'a'.repeat(40)}-2026-11-07.json`)
  })
})
