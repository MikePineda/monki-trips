import { computed, inject, type Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { TRANSLOCO_SCOPE, TranslocoService, type TranslocoScope } from '@jsverse/transloco'
import { LangStore } from '../../../core/i18n/lang.store'
import { formatLocaleFor } from '../../../domain/locale'
import { TRIP_TABS } from '../../../layouts/trip-shell/trip-shell.component'

/**
 * What every mock screen needs: the `Intl` locale of the active language
 * and the translated tab labels from the `shell` scope (the mock provides
 * both its own `styleguide` scope and `shell`; Transloco hands them as a
 * list, so the shell one is picked by name).
 */
export function mockLocale() {
  const lang = inject(LangStore)
  return {
    locale: computed(() => formatLocaleFor(lang.lang())),
    tabLabels: scopedLabels(
      'shell',
      TRIP_TABS.map((tab) => `tabs.${tab.id}`)
    ),
  }
}

/**
 * Translated strings for code (option labels, titles) from one of the
 * scopes the component provides, as a signal that follows the language
 * and the lazy catalogue: `translate()` before the catalogue has loaded
 * would hand back the raw key.
 */
export function scopedLabels(scopeName: string, keys: readonly string[]): Signal<string[]> {
  const transloco = inject(TranslocoService)
  const provided = inject(TRANSLOCO_SCOPE)
  const scopes = (Array.isArray(provided) ? provided : [provided]) as TranslocoScope[]
  const scope = scopes.find((item) => typeof item === 'object' && item?.scope === scopeName)
  return toSignal(transloco.selectTranslate<string[]>([...keys], {}, scope), {
    initialValue: [] as string[],
  })
}
