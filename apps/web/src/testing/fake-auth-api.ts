import type { AppConfig, Trip, TripInvitationPreview, UserProfile } from '@monkitrips/shared'
import type { AuthApi, SignupInput } from '../app/core/api/auth-api'
import { FakeApi } from './fake-api'
import { fakeTrip } from './fake-trips-api'

export const FAKE_APP_CONFIG: AppConfig = {
  registrationOpen: true,
  locales: ['en', 'es'],
  defaultLocale: 'en',
  version: '0.1.0',
  pushEnabled: true,
  vapidPublicKey:
    'BJT8n4mGFig1eRSRezUN_1iZzDuim2OD5KrJzqtXgR8MBLTmVl1OVY8vuhGeVv2MdAswfZtGdXtS-YSU117sKFg',
}

/** In-memory stand-in with knobs for registration and the invitation it previews. */
export class FakeAuthApi extends FakeApi implements AuthApi {
  appConfig: AppConfig = FAKE_APP_CONFIG
  invitation: TripInvitationPreview = {
    tripName: 'Sample trip',
    role: 'editor',
    requiresEmail: false,
  }
  signedUp: UserProfile | null = null

  config(): Promise<AppConfig> {
    return this.run('config', () => this.appConfig)
  }

  signup(input: SignupInput): Promise<UserProfile> {
    return this.run(`signup:${input.email}`, () => {
      this.signedUp = {
        id: 'new-user',
        email: input.email,
        displayName: input.displayName,
        locale: input.locale ?? 'en',
        timezone: input.timezone ?? 'UTC',
        theme: 'system',
        emailVerifiedAt: input.invitationToken ? '2026-11-07T00:00:00.000Z' : null,
        status: 'active',
        plan: 'free',
        deletionScheduledAt: null,
        createdAt: '2026-11-07T00:00:00.000Z',
      }
      return this.signedUp
    })
  }

  verifyEmail(token: string): Promise<void> {
    return this.run(`verifyEmail:${token}`, () => undefined)
  }

  verifyCode(code: string): Promise<UserProfile> {
    return this.run(`verifyCode:${code}`, () => ({
      ...(this.signedUp ?? FAKE_VERIFIED_USER),
      emailVerifiedAt: '2026-11-07T00:00:00.000Z',
    }))
  }

  resendVerification(): Promise<void> {
    return this.run('resendVerification', () => undefined)
  }

  forgotPassword(email: string): Promise<void> {
    return this.run(`forgotPassword:${email}`, () => undefined)
  }

  resetPassword(input: { token: string; password: string }): Promise<void> {
    return this.run(`resetPassword:${input.token}`, () => undefined)
  }

  invitationPreview(token: string): Promise<TripInvitationPreview> {
    return this.run(`invitationPreview:${token}`, () => this.invitation)
  }

  acceptInvitation(token: string): Promise<Trip> {
    return this.run(`acceptInvitation:${token}`, () =>
      fakeTrip({ id: 'invited-trip', name: this.invitation.tripName })
    )
  }
}

const FAKE_VERIFIED_USER: UserProfile = {
  id: 'local-traveller',
  email: 'traveller@example.com',
  displayName: 'Traveller',
  locale: 'en',
  timezone: 'UTC',
  theme: 'system',
  emailVerifiedAt: null,
  status: 'active',
  plan: 'free',
  deletionScheduledAt: null,
  createdAt: '2026-11-01T00:00:00.000Z',
}
