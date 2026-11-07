import type { AppConfig, Trip, TripInvitationPreview, UserProfile } from '@monkitrips/shared'
import type { ApiClientLoader } from './api'
import { apiCall } from './api-failure'
import type { AuthApi, SignupInput } from './auth-api'

/** `AuthApi` over the typed client. */
export class RealAuthApi implements AuthApi {
  constructor(private readonly client: ApiClientLoader) {}

  async config(): Promise<AppConfig> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('config.show', {}))
    return data
  }

  async signup(input: SignupInput): Promise<UserProfile> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('auth.signup', { body: input }))
    return data
  }

  async verifyEmail(token: string): Promise<void> {
    const api = await this.client()
    await apiCall(() => api.request('auth.email.verify', { body: { token } }))
  }

  async verifyCode(code: string): Promise<UserProfile> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('auth.email.verifyCode', { body: { code } }))
    return data
  }

  async resendVerification(): Promise<void> {
    const api = await this.client()
    await apiCall(() => api.request('auth.email.resend', {}))
  }

  async forgotPassword(email: string): Promise<void> {
    const api = await this.client()
    await apiCall(() => api.request('auth.password.forgot', { body: { email } }))
  }

  async resetPassword(input: { token: string; password: string }): Promise<void> {
    const api = await this.client()
    await apiCall(() => api.request('auth.password.reset', { body: input }))
  }

  async invitationPreview(token: string): Promise<TripInvitationPreview> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('invitations.show', { params: { token } }))
    return data
  }

  async acceptInvitation(token: string): Promise<Trip> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('invitations.accept', { params: { token } }))
    return data
  }
}
