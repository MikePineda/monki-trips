import {
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer,
  type EnvironmentProviders,
} from '@angular/core'
import { TranslocoService, provideTransloco } from '@jsverse/transloco'
import { firstValueFrom } from 'rxjs'
import { APP_LANGS, DEFAULT_LANG } from '../../domain/locale'
import { LangStore } from './lang.store'
import { TranslocoFetchLoader } from './transloco-fetch.loader'

/**
 * Transloco with en and es switchable at runtime; English is the default and
 * the fallback. Before the first screen the language is picked (stored
 * choice, else device) and its global catalogue loaded, so nothing renders
 * raw keys.
 */
export function provideI18n(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideTransloco({
      config: {
        availableLangs: [...APP_LANGS],
        defaultLang: DEFAULT_LANG,
        fallbackLang: DEFAULT_LANG,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: { useFallbackTranslation: true, logMissingKey: isDevMode() },
      },
      loader: TranslocoFetchLoader,
    }),
    provideAppInitializer(async () => {
      const lang = inject(LangStore).init()
      await firstValueFrom(inject(TranslocoService).load(lang))
    }),
  ])
}
