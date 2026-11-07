import i18nManager from '@adonisjs/i18n/services/main'
import type { Locale, PushPayload } from '@monkitrips/shared'

/**
 * The push messages the app sends, rendered from
 * `resources/lang/<locale>/push.json` in the recipient's locale. `url` is a
 * path on the app's origin: the service worker opens it on tap. Reminders
 * (leave at, due tasks, check-out, flight changes) join in WP 2.7b.
 */
export class PushMessages {
  /** "Notifications work on this device", sent from Settings and `node ace push:test`. */
  test(locale: Locale): PushPayload {
    const t = i18nManager.locale(locale)
    return {
      title: t.t('push.test.title'),
      body: t.t('push.test.body'),
      url: '/settings',
      tag: 'test',
    }
  }
}
