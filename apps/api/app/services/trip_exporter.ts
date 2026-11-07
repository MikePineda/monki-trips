import { inject } from '@adonisjs/core'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { TRIP_JSON_DOWNLOAD_URL_TTL_SECONDS, type TripJsonV1 } from '@monkitrips/shared'
import type Trip from '#models/trip'
import { Clock } from '#services/clock'
import { TripSnapshot } from '#services/trip_snapshot'
import { buildTripJsonV1, type ExportedFile } from '#domain/trip_export'
import { contentDispositionFor } from '#domain/document_files'

/**
 * A whole trip as one trip JSON v1 document (`GET /trips/:tripId/export`,
 * one per trip in `GET /me/export`). The bytes of file documents stay in
 * the store: each gets a signed download link that works for five minutes,
 * so whoever holds the file can fetch them right away.
 */
@inject()
export class TripExporter {
  constructor(
    private readonly clock: Clock,
    private readonly snapshots: TripSnapshot
  ) {}

  async build(trip: Trip, exportedAt: Date = this.clock.now()): Promise<TripJsonV1> {
    const snapshot = await this.snapshots.build(trip)
    const files = new Map<string, ExportedFile>()
    const rows = (await db
      .from('documents')
      .where('trip_id', trip.id)
      .where('kind', 'file')
      .whereNull('deleted_at')
      .select('id', 'storage_key', 'mime', 'title')) as {
      id: string
      storage_key: string | null
      mime: string | null
      title: string
    }[]
    for (const row of rows) {
      files.set(row.id, {
        storageKey: row.storage_key,
        downloadUrl: row.storage_key
          ? await this.signedUrl(row.storage_key, row.mime, row.title)
          : null,
      })
    }
    return buildTripJsonV1({ snapshot, files, exportedAt })
  }

  /** A download link, or null when the store cannot sign one right now (the export still succeeds). */
  private async signedUrl(key: string, mime: string | null, title: string): Promise<string | null> {
    try {
      return await drive.use().getSignedUrl(key, {
        expiresIn: `${TRIP_JSON_DOWNLOAD_URL_TTL_SECONDS}s`,
        contentType: mime ?? undefined,
        contentDisposition: contentDispositionFor(mime, title),
      })
    } catch (error) {
      logger.warn({ err: error }, 'trip export: could not sign a document url')
      return null
    }
  }
}
