/**
 * Source of exchange rates. The container binds the implementation chosen by
 * `FX_PROVIDER` (`providers/fx_provider.ts`): `frankfurter` calls the public
 * Frankfurter API, `fake` answers a fixed table (tests, offline development).
 * Rates are units of `quote` per 1 `base`, as decimal strings.
 */
export abstract class FxRateProvider {
  /**
   * Rates of `base` against `symbols` on `date` (`YYYY-MM-DD`). Symbols the
   * provider does not know are left out. Throws `FxUnavailableError` when
   * the source cannot answer.
   */
  abstract rates(base: string, symbols: string[], date: string): Promise<Record<string, string>>
}

/** The provider could not answer (network, upstream error, unknown base). */
export class FxUnavailableError extends Error {
  constructor(message = 'exchange rates unavailable') {
    super(message)
    this.name = 'FxUnavailableError'
  }
}
