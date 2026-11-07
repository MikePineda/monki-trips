import { FxRateProvider, FxUnavailableError } from '#services/fx/fx_rate_provider'

/** Frankfurter's public endpoint; no key, no personal data. */
export const FRANKFURTER_BASE_URL = 'https://api.frankfurter.dev/v1'

/**
 * Rates from Frankfurter (`FX_PROVIDER=frankfurter`): `GET /v1/{date}?base=
 * &symbols=`. A weekend or holiday answers the previous working day's
 * rates; the caller caches them under the day it asked for. Numbers are
 * turned into decimal strings right away so no arithmetic happens on floats.
 */
export class FrankfurterProvider extends FxRateProvider {
  constructor(
    private readonly baseUrl = FRANKFURTER_BASE_URL,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    super()
  }

  async rates(base: string, symbols: string[], date: string): Promise<Record<string, string>> {
    const url = new URL(`${this.baseUrl}/${date}`)
    url.searchParams.set('base', base)
    url.searchParams.set('symbols', symbols.join(','))
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
    } catch (error) {
      throw new FxUnavailableError(`frankfurter unreachable: ${(error as Error).name}`)
    }
    if (!response.ok) throw new FxUnavailableError(`frankfurter answered ${response.status}`)
    const body = (await response.json()) as { rates?: Record<string, number> }
    if (!body.rates || typeof body.rates !== 'object') {
      throw new FxUnavailableError('frankfurter answered without rates')
    }
    const result: Record<string, string> = {}
    for (const [symbol, rate] of Object.entries(body.rates)) {
      if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
        result[symbol] = rate.toFixed(10).replace(/0+$/, '').replace(/\.$/, '')
      }
    }
    return result
  }
}
