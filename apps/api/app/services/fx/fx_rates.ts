import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { FxRate, FxSource } from '@monkitrips/shared'
import { FxRateProvider, FxUnavailableError } from '#services/fx/fx_rate_provider'
import { normalizeDecimalString } from '#services/sync/column_types'

export interface KnownRate {
  rate: string
  source: FxSource
}

/**
 * Exchange rates by day, cached in `fx_rates` so the provider is asked once
 * per (base, quote, day). The base currency against itself is 1
 * (`identity`). `find` never throws: a provider outage leaves the expense
 * waiting for its rate; `rates` (the `/fx/rates` route) reports it as 503.
 */
@inject()
export class FxRates {
  constructor(private readonly provider: FxRateProvider) {}

  /** The rate of `quote` per 1 `base` on `date`, or null when nobody can tell right now. */
  async find(
    base: string,
    quote: string,
    date: string,
    client: QueryClientContract | TransactionClientContract = db.connection()
  ): Promise<KnownRate | null> {
    if (base === quote) return { rate: '1', source: 'identity' }
    const cached = await this.cached(base, [quote], date, client)
    if (cached[quote]) return cached[quote]
    try {
      const fetched = await this.fetchAndCache(base, [quote], date, client)
      return fetched[quote] ?? null
    } catch (error) {
      if (error instanceof FxUnavailableError) return null
      throw error
    }
  }

  /** Rates for several symbols (`GET /fx/rates`); throws `FxUnavailableError` when a missing one cannot be fetched. */
  async rates(base: string, symbols: string[], date: string): Promise<FxRate[]> {
    const wanted = [...new Set(symbols.filter((symbol) => symbol !== base))]
    const client = db.connection()
    const known = await this.cached(base, wanted, date, client)
    const missing = wanted.filter((symbol) => !known[symbol])
    if (missing.length > 0) {
      Object.assign(known, await this.fetchAndCache(base, missing, date, client))
    }
    const result: FxRate[] = symbols.includes(base)
      ? [{ base, quote: base, rateOn: date, rate: '1', source: 'identity' }]
      : []
    for (const symbol of wanted) {
      const rate = known[symbol]
      if (rate)
        result.push({ base, quote: symbol, rateOn: date, rate: rate.rate, source: rate.source })
    }
    return result
  }

  private async cached(
    base: string,
    symbols: string[],
    date: string,
    client: QueryClientContract | TransactionClientContract
  ): Promise<Record<string, KnownRate>> {
    if (symbols.length === 0) return {}
    const rows = await client
      .from('fx_rates')
      .where('base', base)
      .whereIn('quote', symbols)
      .where('rate_on', date)
      .select('quote', 'rate', 'source')
    const result: Record<string, KnownRate> = {}
    for (const row of rows as { quote: string; rate: string; source: FxSource }[]) {
      result[row.quote] = { rate: normalizeDecimalString(row.rate), source: row.source }
    }
    return result
  }

  private async fetchAndCache(
    base: string,
    symbols: string[],
    date: string,
    client: QueryClientContract | TransactionClientContract
  ): Promise<Record<string, KnownRate>> {
    const fetched = await this.provider.rates(base, symbols, date)
    const result: Record<string, KnownRate> = {}
    for (const [quote, rate] of Object.entries(fetched)) {
      result[quote] = { rate, source: 'frankfurter' }
      await client
        .table('fx_rates')
        .insert({ base, quote, rate_on: date, rate, source: 'frankfurter' })
        .onConflict(['base', 'quote', 'rate_on'])
        .ignore()
    }
    return result
  }
}
