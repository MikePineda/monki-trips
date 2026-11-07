import { DEFAULT_LANG, isAppLang, type AppLang } from '../../domain/locale'

export interface LocaleInputs {
  /** The language the person chose before (localStorage), if any. */
  stored: string | null
  /** `navigator.languages`, most preferred first. */
  deviceLanguages: readonly string[]
}

/**
 * The UI language on start: a stored choice wins; otherwise the first device
 * language we speak (`es-*` -> es, `en-*` -> en); otherwise English. Pure:
 * the caller reads storage and the navigator.
 */
export function pickLocale({ stored, deviceLanguages }: LocaleInputs): AppLang {
  if (isAppLang(stored)) {
    return stored
  }
  for (const tag of deviceLanguages) {
    const primary = tag.split('-')[0]?.toLowerCase()
    if (isAppLang(primary)) {
      return primary
    }
  }
  return DEFAULT_LANG
}
