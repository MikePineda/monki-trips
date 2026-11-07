import { test } from '@japa/runner'
import { createHash, randomUUID } from 'node:crypto'
import { readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import type { TripTaskRow, TripDocumentRow } from '@monkitrips/shared'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { addMember, makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { mutation, pushApplied, pushOne } from '#tests/helpers/sync'

/** A tiny but real PDF (magic bytes first), synthetic content. */
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n'
)
/** A PNG header followed by nothing much. */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('0000000d49484452', 'hex'),
  Buffer.alloc(32),
])
/** A Windows executable header, renamed to .pdf. */
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64)])

test.group('Documents', (group) => {
  useFixedClock(group, new Date('2026-11-07T10:00:00Z'))
  group.teardown(() => rm(app.tmpPath('drive'), { recursive: true, force: true }))

  test('uploading a pdf stores the bytes under the trip and answers the metadata', async ({
    client,
    db: dbAssert,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const id = randomUUID()

    const response = await actingAs(client.post(`/api/v1/trips/${trip.id}/documents`), owner)
      .field('id', id)
      .field('title', 'Rail voucher')
      .field('tags[]', 'show_on_phone')
      .file('file', PDF, { filename: 'voucher.pdf' })

    response.assertStatus(201)
    const document: TripDocumentRow = response.body().data
    assert.include(document, {
      id,
      tripId: trip.id,
      kind: 'file',
      title: 'Rail voucher',
      mime: 'application/pdf',
      sizeBytes: PDF.length,
      sha256: createHash('sha256').update(PDF).digest('hex'),
      uploadedBy: owner.id,
      availableOffline: false,
    })
    assert.deepEqual(document.tags, ['show_on_phone'])
    assert.notProperty(document, 'storageKey')
    await dbAssert.assertHas('documents', { id, storage_key: `trips/${trip.id}/${id}` })
    assert.isTrue(await drive.use().exists(`trips/${trip.id}/${id}`))
    await dbAssert.assertHas('trip_activity', {
      entity: 'document',
      entity_id: id,
      action: 'created',
    })
  })

  test('the multipart temp file is deleted once the bytes are stored', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const before = new Set(await readdir(tmpdir()))
    // A unique payload, so a leftover temp file can be recognised by its bytes.
    const payload = Buffer.concat([PDF, Buffer.from(`%${randomUUID()}\n`)])

    const response = await actingAs(client.post(`/api/v1/trips/${trip.id}/documents`), owner)
      .field('title', 'Temp check')
      .file('file', payload, { filename: 'temp.pdf' })

    response.assertStatus(201)
    const leftovers: string[] = []
    for (const name of await readdir(tmpdir())) {
      if (before.has(name)) continue
      const bytes = await readFile(join(tmpdir(), name)).catch(() => null)
      if (bytes?.equals(payload)) leftovers.push(name)
    }
    assert.deepEqual(leftovers, [])
  })

  test('upload rejects disguised executable', async ({ client, db: dbAssert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const response = await actingAs(client.post(`/api/v1/trips/${trip.id}/documents`), owner)
      .field('title', 'Not a pdf')
      .file('file', EXE, { filename: 'ticket.pdf', contentType: 'application/pdf' })

    response.assertStatus(415)
    response.assertBodyContains({ code: 'E_UNSUPPORTED_FILE' })
    await dbAssert.assertCount('documents', 0)
  })

  test('a file over 25 MB answers 413', async ({ client, db: dbAssert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const big = Buffer.concat([PDF, Buffer.alloc(25 * 1024 * 1024)])

    const response = await actingAs(client.post(`/api/v1/trips/${trip.id}/documents`), owner)
      .field('title', 'Huge')
      .file('file', big, { filename: 'huge.pdf' })

    response.assertStatus(413)
    response.assertBodyContains({ code: 'E_FILE_TOO_LARGE' })
    await dbAssert.assertCount('documents', 0)
  }).timeout(60000)

  test('uploading the same id again is idempotent for the trip', async ({
    client,
    db: dbAssert,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const id = randomUUID()
    const upload = () =>
      actingAs(client.post(`/api/v1/trips/${trip.id}/documents`), owner)
        .field('id', id)
        .field('title', 'Map')
        .file('file', PNG, { filename: 'map.png' })

    const first = await upload()
    const second = await upload()

    first.assertStatus(201)
    second.assertStatus(200)
    assert.equal(second.body().data.id, id)
    await dbAssert.assertCount('documents', 1)
  })

  test('file download redirects to a short signed url', async ({ client, assert }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, editor)
    const upload = await actingAs(client.post(`/api/v1/trips/${trip.id}/documents`), owner)
      .field('title', 'Voucher')
      .file('file', PDF, { filename: 'voucher.pdf' })
    const id = upload.body().data.id

    const response = await actingAs(
      client.get(`/api/v1/trips/${trip.id}/documents/${id}/file`).redirects(0),
      editor
    )

    response.assertStatus(302)
    const location = new URL(response.header('location')!, 'http://127.0.0.1')
    assert.include(location.pathname, `/drive/fs/trips/${trip.id}/${id}`)
    assert.isNotEmpty(location.searchParams.get('signature'))
    assert.equal(
      location.searchParams.get('contentDisposition'),
      `inline; filename="Voucher.pdf"; filename*=UTF-8''Voucher.pdf`
    )
    assert.equal(response.header('cache-control'), 'no-store')

    // The signed URL serves the bytes until it expires (300 s).
    const served = await client.get(`${location.pathname}${location.search}`)
    served.assertStatus(200)
    assert.equal(served.header('content-type'), 'application/pdf')
  })

  test('a link document has no file to download', async ({ client }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const link = await pushApplied<TripDocumentRow>(
      client,
      owner,
      mutation(trip.id, 'document', {
        kind: 'link',
        title: 'Hotel',
        url: 'https://example.com/hotel',
      })
    )

    const response = await actingAs(
      client.get(`/api/v1/trips/${trip.id}/documents/${link.id}/file`).redirects(0),
      owner
    )

    response.assertStatus(404)
  })

  test('a file document cannot be created through push, its metadata can be edited', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const upload = await actingAs(client.post(`/api/v1/trips/${trip.id}/documents`), owner)
      .field('title', 'Voucher')
      .file('file', PDF, { filename: 'voucher.pdf' })
    const id = upload.body().data.id

    const created = await pushOne(
      client,
      owner,
      mutation(trip.id, 'document', { kind: 'file', title: 'No bytes' })
    )
    const edited = await pushApplied<TripDocumentRow>(
      client,
      owner,
      mutation(
        trip.id,
        'document',
        { title: 'Renamed voucher', availableOffline: true, mime: 'text/html' },
        { id }
      )
    )

    assert.equal(created.status, 'rejected')
    assert.deepEqual(
      created.error?.errors?.map((e) => [e.field, e.rule]),
      [['kind', 'uploadRequired']]
    )
    assert.include(edited, {
      title: 'Renamed voucher',
      availableOffline: true,
      mime: 'application/pdf',
    })
  })

  test('print tag creates print task through sync push', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner, { startsOn: '2027-01-20', endsOn: '2027-02-06' })
    const upload = await actingAs(client.post(`/api/v1/trips/${trip.id}/documents`), owner)
      .field('title', 'Rail voucher')
      .file('file', PDF, { filename: 'voucher.pdf' })
    const id = upload.body().data.id
    assert.isEmpty(await db.from('tasks').where('trip_id', trip.id))

    await pushApplied(client, owner, mutation(trip.id, 'document', { tags: ['print'] }, { id }))

    const [task] = await db.from('tasks').where('trip_id', trip.id)
    assert.include(task, {
      title: 'Rail voucher',
      title_key: 'print_document',
      origin: 'document',
      source_document_id: id,
      priority: 'normal',
    })
    assert.equal(task.due_on.toISOString().slice(0, 10), '2027-01-19')

    // Tagging again keeps one task; renaming renames it; untagging deletes it unless done.
    await pushApplied(
      client,
      owner,
      mutation(
        trip.id,
        'document',
        { tags: ['print', 'show_on_phone'], title: 'Train voucher' },
        { id }
      )
    )
    const open = await db.from('tasks').where('trip_id', trip.id).whereNull('deleted_at')
    assert.lengthOf(open, 1)
    assert.equal(open[0].title, 'Train voucher')

    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'task', { doneAt: '2026-11-07T09:00:00.000Z' }, { id: task.id })
    )
    await pushApplied(client, owner, mutation(trip.id, 'document', { tags: [] }, { id }))
    const [done] = await db.from('tasks').where('id', task.id)
    assert.isNull(done.deleted_at)
    assert.equal(done.done_by, owner.id)
  })

  test('uploading with the print tag creates the task right away and deleting the document removes it', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const upload = await actingAs(client.post(`/api/v1/trips/${trip.id}/documents`), owner)
      .field('title', 'Boarding pass')
      .field('tags[]', 'print')
      .file('file', PDF, { filename: 'pass.pdf' })
    upload.assertStatus(201)
    const id = upload.body().data.id
    const [task] = await db.from('tasks').where('source_document_id', id)
    assert.equal(task.title_key, 'print_document')

    await pushApplied(client, owner, mutation(trip.id, 'document', {}, { id, op: 'delete' }))

    const [after] = await db.from('tasks').where('id', task.id)
    assert.isNotNull(after.deleted_at)
    const reopened = await pushOne(
      client,
      owner,
      mutation(trip.id, 'task', { title: 'x' }, { id: task.id })
    )
    assert.equal(reopened.error?.code, 'E_ROW_DELETED')
  })

  test('a done task records who did it and reopening clears it', async ({ client, assert }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, editor)
    const task = await pushApplied<TripTaskRow>(
      client,
      owner,
      mutation(trip.id, 'task', { title: 'Book the train' })
    )

    const done = await pushApplied<TripTaskRow>(
      client,
      editor,
      mutation(
        trip.id,
        'task',
        { doneAt: '2026-11-07T09:30:00.000Z' },
        { id: task.id, changedAt: '2026-11-07T09:30:00.000Z' }
      )
    )
    const reopened = await pushApplied<TripTaskRow>(
      client,
      owner,
      mutation(
        trip.id,
        'task',
        { doneAt: null },
        { id: task.id, changedAt: '2026-11-07T09:45:00.000Z' }
      )
    )

    assert.equal(done.doneBy, editor.id)
    assert.equal(done.doneAt, '2026-11-07T09:30:00.000Z')
    assert.isNull(reopened.doneAt)
    assert.isNull(reopened.doneBy)
  })
})
