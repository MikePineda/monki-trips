import { provideTranslocoScope } from '@jsverse/transloco'

/** The `money` Transloco scope: budget, expenses, the quick expense and the edit sheets. */
export function provideMoneyI18n() {
  return provideTranslocoScope({
    scope: 'money',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
