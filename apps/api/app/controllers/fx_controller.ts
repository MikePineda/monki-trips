import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { ApiEnvelope, FxRate } from '@monkitrips/shared'
import { Clock } from '#services/clock'
import { FxRates } from '#services/fx/fx_rates'
import { FxUnavailableError } from '#services/fx/fx_rate_provider'
import { ApiException } from '#exceptions/api_exception'
import { currencyField, dateField } from '#validators/sync/fields'

const ratesQuery = vine.compile(
  vine.object({
    base: currencyField,
    /** Comma-separated ISO codes. */
    symbols: vine
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}(,[A-Z]{3}){0,19}$/),
    date: dateField.optional(),
  })
)

/**
 * `GET /fx/rates?base=&symbols=&date=`: units of each symbol per 1 base on
 * `date` (today by default), from the cache or the provider. A provider
 * outage answers 503 `E_FX_UNAVAILABLE`; symbols nobody knows are left out.
 */
@inject()
export default class FxController {
  constructor(
    private readonly clock: Clock,
    private readonly fxRates: FxRates
  ) {}

  async rates(ctx: HttpContext): Promise<ApiEnvelope<FxRate[]>> {
    const query = await ratesQuery.validate(ctx.request.qs(), {
      meta: undefined,
      messagesProvider: ctx.i18n.createMessagesProvider(),
    })
    const date = query.date ?? DateTime.fromJSDate(this.clock.now()).toUTC().toISODate()!
    try {
      return { data: await this.fxRates.rates(query.base, query.symbols.split(','), date) }
    } catch (error) {
      if (error instanceof FxUnavailableError) throw new ApiException('E_FX_UNAVAILABLE')
      throw error
    }
  }
}
