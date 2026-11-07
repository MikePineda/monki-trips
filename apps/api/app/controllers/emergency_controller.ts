import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { ApiEnvelope, EmergencyInfo, EmergencyInfoContent } from '@monkitrips/shared'
import { EmergencyDocument } from '#services/emergency_document'
import { emergencyChanges } from '#validators/sync/entities'

/** The emergency document of a trip: read it, or replace it whole. Members only. */
@inject()
export default class EmergencyController {
  constructor(private readonly documents: EmergencyDocument) {}

  async show(ctx: HttpContext): Promise<ApiEnvelope<EmergencyInfo | null>> {
    return { data: await this.documents.read(ctx.trip) }
  }

  /** The body is the whole `EmergencyInfoContent`; keys left out are cleared. */
  async update(ctx: HttpContext): Promise<ApiEnvelope<EmergencyInfo>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const content = (await ctx.request.validateUsing(emergencyChanges)) as EmergencyInfoContent
    return { data: await this.documents.replace(user, ctx.trip, content, ctx.i18n) }
  }
}
