import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { DEFAULT_LOCALE, LOCALES } from '@monkitrips/shared'
import { defineConfig, formatters, loaders } from '@adonisjs/i18n'

/**
 * Server-side translations (error messages today; validation and mails
 * later). Catalogs live in `resources/lang/<locale>/*.json` and a unit test
 * keeps every locale in parity. The request locale comes from
 * Accept-Language (DetectUserLocaleMiddleware), falling back to
 * APP_DEFAULT_LOCALE, which defaults to English.
 */
const i18nConfig = defineConfig({
  defaultLocale: env.get('APP_DEFAULT_LOCALE') ?? DEFAULT_LOCALE,
  supportedLocales: [...LOCALES],
  formatter: formatters.icu(),

  loaders: [
    loaders.fs({
      location: app.languageFilesPath(),
    }),
  ],
})

export default i18nConfig
