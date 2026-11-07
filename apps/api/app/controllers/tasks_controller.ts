import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { ApiEnvelope, TemplateTasksResult } from '@monkitrips/shared'
import { TemplateTasks } from '#services/template_tasks'

/** Tasks over REST: the pre-trip checklist. Everything else about tasks goes through sync push. */
@inject()
export default class TasksController {
  constructor(private readonly templates: TemplateTasks) {}

  /** Adds the template items the trip is missing; idempotent. Members only. */
  async fromTemplate(ctx: HttpContext): Promise<ApiEnvelope<TemplateTasksResult>> {
    const user = ctx.auth.use('web').getUserOrFail()
    return { data: await this.templates.apply(user, ctx.trip, ctx.i18n) }
  }
}
