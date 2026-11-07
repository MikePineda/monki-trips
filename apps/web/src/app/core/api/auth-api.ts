import { inject, InjectionToken } from '@angular/core'
import type { AppConfig, Trip, TripInvitationPreview, UserProfile } from '@monkitrips/shared'
import { API } from './api'
import { RealAuthApi } from './real-auth-api'

export interface SignupInput {
  email: string
  password: string
  displayName: string
  locale?: AppConfig['defaultLocale']
  timezone?: string
  invitationToken?: string
}

/**
 * Account creation, e-mail verification, password reset and invitations:
 * everything around a session that is not the session itself. Failures are
 * ApiFailures with the contract's codes (`E_REGISTRATION_CLOSED`,
 * `E_TOKEN_EXPIRED`, `E_INVITATION_EXPIRED`...).
 */
export interface AuthApi {
  /** Public configuration; also the GET that hands out the CSRF cookie. */
  config(): Promise<AppConfig>
  signup(input: SignupInput): Promise<UserProfile>
  /** The link in the verification mail. */
  verifyEmail(token: string): Promise<void>
  /** The 6-digit code typed into the signed-in app. */
  verifyCode(code: string): Promise<UserProfile>
  resendVerification(): Promise<void>
  forgotPassword(email: string): Promise<void>
  resetPassword(input: { token: string; password: string }): Promise<void>
  invitationPreview(token: string): Promise<TripInvitationPreview>
  acceptInvitation(token: string): Promise<Trip>
}

export const AUTH_API = new InjectionToken<AuthApi>('AUTH_API', {
  providedIn: 'root',
  factory: () => new RealAuthApi(inject(API)),
})
