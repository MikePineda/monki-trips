import type { Translation } from '@jsverse/transloco'
import accountEn from '../app/features/account/i18n/en.json'
import accountEs from '../app/features/account/i18n/es.json'
import authEn from '../app/features/auth/i18n/en.json'
import authEs from '../app/features/auth/i18n/es.json'
import docsEn from '../app/features/docs/i18n/en.json'
import docsEs from '../app/features/docs/i18n/es.json'
import emergencyEn from '../app/features/emergency/i18n/en.json'
import emergencyEs from '../app/features/emergency/i18n/es.json'
import moneyEn from '../app/features/money/i18n/en.json'
import moneyEs from '../app/features/money/i18n/es.json'
import offlineEn from '../app/features/offline/i18n/en.json'
import offlineEs from '../app/features/offline/i18n/es.json'
import shareEn from '../app/features/share/i18n/en.json'
import shareEs from '../app/features/share/i18n/es.json'
import settingsEn from '../app/features/settings/i18n/en.json'
import settingsEs from '../app/features/settings/i18n/es.json'
import styleguideEn from '../app/features/styleguide/i18n/en.json'
import styleguideEs from '../app/features/styleguide/i18n/es.json'
import phrasesEn from '../app/features/phrases/i18n/en.json'
import phrasesEs from '../app/features/phrases/i18n/es.json'
import planEn from '../app/features/plan/i18n/en.json'
import planEs from '../app/features/plan/i18n/es.json'
import eventsEn from '../app/features/plan/events/i18n/en.json'
import eventsEs from '../app/features/plan/events/i18n/es.json'
import historyEn from '../app/features/trips/i18n/en.json'
import historyEs from '../app/features/trips/i18n/es.json'
import passportEn from '../app/features/passport/i18n/en.json'
import passportEs from '../app/features/passport/i18n/es.json'
import todayEn from '../app/features/today/i18n/en.json'
import todayEs from '../app/features/today/i18n/es.json'
import tasksEn from '../app/features/tasks/i18n/en.json'
import tasksEs from '../app/features/tasks/i18n/es.json'
import tripEn from '../app/features/trip/i18n/en.json'
import tripEs from '../app/features/trip/i18n/es.json'
import activityEn from '../app/features/trip/activity/i18n/en.json'
import activityEs from '../app/features/trip/activity/i18n/es.json'
import membersEn from '../app/features/trip/members/i18n/en.json'
import membersEs from '../app/features/trip/members/i18n/es.json'
import shellEn from '../app/layouts/shell/i18n/en.json'
import shellEs from '../app/layouts/shell/i18n/es.json'
import uiEn from '../app/shared/ui/i18n/en.json'
import uiEs from '../app/shared/ui/i18n/es.json'
import type { AppLang } from '../app/domain/locale'

/**
 * Both catalogues of every Transloco scope in the app, keyed by the scope
 * name its provideTranslocoScope() declares. i18nTesting() preloads all of
 * them before the first render, so no spec races a scope's lazy import().
 * A new scope goes here too: i18n-testing.spec.ts fails until it does.
 */
export const SCOPE_CATALOGUES = {
  account: { en: accountEn, es: accountEs },
  activity: { en: activityEn, es: activityEs },
  auth: { en: authEn, es: authEs },
  docs: { en: docsEn, es: docsEs },
  emergency: { en: emergencyEn, es: emergencyEs },
  events: { en: eventsEn, es: eventsEs },
  history: { en: historyEn, es: historyEs },
  members: { en: membersEn, es: membersEs },
  money: { en: moneyEn, es: moneyEs },
  offline: { en: offlineEn, es: offlineEs },
  passport: { en: passportEn, es: passportEs },
  phrases: { en: phrasesEn, es: phrasesEs },
  plan: { en: planEn, es: planEs },
  settings: { en: settingsEn, es: settingsEs },
  share: { en: shareEn, es: shareEs },
  shell: { en: shellEn, es: shellEs },
  styleguide: { en: styleguideEn, es: styleguideEs },
  tasks: { en: tasksEn, es: tasksEs },
  today: { en: todayEn, es: todayEs },
  trip: { en: tripEn, es: tripEs },
  ui: { en: uiEn, es: uiEs },
} satisfies Record<string, Record<AppLang, Translation>>

/** Every scope catalogue keyed like a Transloco path (`'shell/es'`). */
export function scopeCataloguesByPath(): Record<string, Translation> {
  return Object.fromEntries(
    Object.entries(SCOPE_CATALOGUES).flatMap(([scope, catalogues]) =>
      Object.entries(catalogues).map(([lang, catalogue]) => [`${scope}/${lang}`, catalogue])
    )
  )
}
