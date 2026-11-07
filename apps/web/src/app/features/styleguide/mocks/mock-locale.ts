import { computed, inject } from '@angular/core'
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
  const transloco = inject(TranslocoService)
  const provided = inject(TRANSLOCO_SCOPE)
  const scopes = (Array.isArray(provided) ? provided : [provided]) as TranslocoScope[]
  const shell = scopes.find((scope) => typeof scope === 'object' && scope?.scope === 'shell')
  const tabLabels = toSignal(
    transloco.selectTranslate<string[]>(
      TRIP_TABS.map((tab) => `tabs.${tab.id}`),
      {},
      shell
    ),
    { initialValue: [] as string[] }
  )
  return {
    locale: computed(() => formatLocaleFor(lang.lang())),
    tabLabels,
  }
}
