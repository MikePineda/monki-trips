import { Pipe, inject, type PipeTransform } from '@angular/core'
import { LangStore } from '../../../core/i18n/lang.store'
import { formatLocaleFor } from '../../../domain/locale'
import { formatMoney } from '../../../domain/money'

/**
 * Money as the UI writes it everywhere: `{{ amountMinor | mkMoney: currency }}`,
 * `{{ base | mkMoney: 'AUD' : true }}` when the trip mixes currencies (`A$`).
 * Narrow symbol, the currency's own decimals, U+2212 for negatives, the
 * separators of the active language. Impure so a language switch re-renders.
 */
@Pipe({ name: 'mkMoney', pure: false })
export class MkMoneyPipe implements PipeTransform {
  private readonly lang = inject(LangStore)

  transform(
    amountMinor: number | bigint | null | undefined,
    currency: string,
    disambiguate = false
  ): string {
    if (amountMinor === null || amountMinor === undefined) {
      return ''
    }
    return formatMoney(amountMinor, currency, formatLocaleFor(this.lang.lang()), { disambiguate })
  }
}
