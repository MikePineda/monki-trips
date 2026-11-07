import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { ApiEnvelope, TripImportResult, TripJsonV1 } from '@monkitrips/shared'
import { Clock } from '#services/clock'
import { TripExporter } from '#services/trip_exporter'
import { TripImporter } from '#services/trip_importer'
import { tripJsonSchema } from '#services/trip_json_schema'
import { tripExportFileName } from '#domain/export_file_name'
import { tripImportQueryValidator } from '#validators/trip_import'

/**
 * Trip JSON v1: a whole trip as one file. Export is a download (the body is
 * the document itself, not an envelope, so the file re-imports as is);
 * import validates, resolves refs and rebuilds the trip as a new one owned
 * by the caller, or only reports what it would do with `?dryRun=true`. The
 * schema route publishes the format for editors and other tools.
 */
@inject()
export default class TripJsonController {
  constructor(
    private readonly clock: Clock,
    private readonly exporter: TripExporter,
    private readonly importer: TripImporter
  ) {}

  /** Any member may take the whole trip with them. */
  async export(ctx: HttpContext): Promise<TripJsonV1> {
    const exportedAt = this.clock.now()
    const document = await this.exporter.build(ctx.trip, exportedAt)
    ctx.response.header(
      'Content-Disposition',
      `attachment; filename="${tripExportFileName(ctx.trip.name, exportedAt)}"`
    )
    ctx.response.header('Cache-Control', 'no-store')
    return document
  }

  /** 201 with the new trip, or 200 with the summary alone after a dry run. 422 lists what is wrong, and nothing is written. */
  async import(ctx: HttpContext): Promise<ApiEnvelope<TripImportResult>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const query = await tripImportQueryValidator.validate(ctx.request.qs(), {
      meta: undefined,
      messagesProvider: ctx.i18n.createMessagesProvider(),
    })
    const result = await this.importer.import(
      user,
      ctx.request.body(),
      { dryRun: query.dryRun ?? false },
      ctx.i18n
    )
    if (result.tripId) ctx.response.status(201)
    return { data: result }
  }

  /** The JSON Schema of the format, public and cacheable. */
  async schema(ctx: HttpContext): Promise<Record<string, unknown>> {
    ctx.response.header('Cache-Control', 'public, max-age=3600')
    return tripJsonSchema()
  }
}
