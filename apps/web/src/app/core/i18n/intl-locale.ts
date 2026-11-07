import { computed, inject, type Signal } from '@angular/core'
import { formatLocaleFor } from '../../domain/locale'
import { LangStore } from './lang.store'

/** The BCP 47 locale `Intl` formats with, following the active UI language. */
export function intlLocale(): Signal<string> {
  const lang = inject(LangStore)
  return computed(() => formatLocaleFor(lang.lang()))
}
