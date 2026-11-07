import { DOCUMENT, Injectable, inject, signal } from '@angular/core'
import { TranslocoService } from '@jsverse/transloco'
import { DEFAULT_LANG, formatLocaleFor, type AppLang } from '../../domain/locale'
import { pickLocale } from './pick-locale'

/** localStorage key of the chosen UI language (Settings will write it too). */
export const LANG_STORAGE_KEY = 'mt:lang'

/**
 * The active UI language. On start it takes the stored choice, else the
 * device's first supported language, else English, and remembers it so a
 * later choice in Settings sticks. Storage may be blocked (private mode):
 * every access is guarded and the app keeps working without it.
 */
@Injectable({ providedIn: 'root' })
export class LangStore {
  private readonly transloco = inject(TranslocoService)
  private readonly document = inject(DOCUMENT)
  private readonly current = signal<AppLang>(DEFAULT_LANG)

  readonly lang = this.current.asReadonly()

  init(): AppLang {
    const lang = pickLocale({
      stored: this.read(),
      deviceLanguages: this.document.defaultView?.navigator.languages ?? [],
    })
    this.use(lang)
    return lang
  }

  use(lang: AppLang): void {
    this.current.set(lang)
    this.transloco.setActiveLang(lang)
    this.document.documentElement.lang = formatLocaleFor(lang)
    this.write(lang)
  }

  private read(): string | null {
    try {
      return this.document.defaultView?.localStorage.getItem(LANG_STORAGE_KEY) ?? null
    } catch {
      return null
    }
  }

  private write(lang: AppLang): void {
    try {
      this.document.defaultView?.localStorage.setItem(LANG_STORAGE_KEY, lang)
    } catch {
      // Storage blocked: the choice lasts for this visit only.
    }
  }
}
