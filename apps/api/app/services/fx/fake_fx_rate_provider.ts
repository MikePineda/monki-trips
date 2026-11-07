import { FxRateProvider, FxUnavailableError } from '#services/fx/fx_rate_provider'

/**
 * Fixed rates for tests and offline development (`FX_PROVIDER=fake`). The
 * table is in units of the quote currency per 1 unit of the base; any other
 * pair derives through USD, and an unknown currency is left out of the
 * answer. `unavailable` makes every call fail like a provider outage.
 */
export class FakeFxRateProvider extends FxRateProvider {
  /** Units per 1 USD. Synthetic round numbers, not market data. */
  static readonly PER_USD: Readonly<Record<string, string>> = {
    USD: '1',
    AUD: '1.5',
    EUR: '0.9',
    GBP: '0.8',
    THB: '33.75',
    JPY: '142.5',
    KWD: '0.3',
    NZD: '1.6',
    SGD: '1.35',
  }

  unavailable = false
  readonly calls: { base: string; symbols: string[]; date: string }[] = []

  async rates(base: string, symbols: string[], date: string): Promise<Record<string, string>> {
    this.calls.push({ base, symbols, date })
    if (this.unavailable) throw new FxUnavailableError('fake provider is unavailable')
    const perUsdBase = FakeFxRateProvider.PER_USD[base]
    if (!perUsdBase) throw new FxUnavailableError(`unknown base currency`)
    const result: Record<string, string> = {}
    for (const symbol of symbols) {
      const perUsdQuote = FakeFxRateProvider.PER_USD[symbol]
      if (!perUsdQuote) continue
      // quote per base = (quote per USD) / (base per USD), kept to 10 decimals.
      const rate = Number(perUsdQuote) / Number(perUsdBase)
      result[symbol] = rate.toFixed(10).replace(/0+$/, '').replace(/\.$/, '')
    }
    return result
  }
}
