import { provideTranslocoScope } from '@jsverse/transloco'

/** The `members` Transloco scope: members, invitations and travellers of a trip. */
export function provideMembersI18n() {
  return provideTranslocoScope({
    scope: 'members',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}

/** Error codes the `members` catalogue has a message for (`members.errors.<code>`). */
export const MEMBERS_ERROR_CODES = [
  'E_OWNER_CANNOT_LEAVE',
  'E_TRIP_ROLE',
  'E_NOT_A_MEMBER',
  'E_EMAIL_NOT_VERIFIED',
  'E_VALIDATION_ERROR',
  'E_TOO_MANY_REQUESTS',
  'E_UNAUTHORIZED',
  'E_BAD_CSRF_TOKEN',
] as const
