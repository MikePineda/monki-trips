import i18nManager from '@adonisjs/i18n/services/main'
import type { Locale, PlannedReminder, PushPayload } from '@monkitrips/shared'

/**
 * The push messages the app sends, rendered from
 * `resources/lang/<locale>/push.json` in the recipient's locale. `url` is a
 * path on the app's origin: the service worker opens it on tap.
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

  /**
   * A planned reminder (`reminders.<kind>.*` keys of the shared planner,
   * under `push.`). The tag `<kind>:<refId>` makes a repeated reminder
   * replace the earlier notification on the device.
   */
  reminder(locale: Locale, reminder: PlannedReminder): PushPayload {
    const t = i18nManager.locale(locale)
    const params = { ...reminder.params }
    return {
      title: t.t(`push.${reminder.titleKey}`, params),
      body: t.t(`push.${reminder.bodyKey}`, params),
      url: reminder.url,
      tag: `${reminder.kind}:${reminder.refId}`,
    }
  }
}
