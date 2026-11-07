import type { AccountExport, UserProfile } from '@monkitrips/shared'
import type { AccountApi, UpdateProfileInput } from './account-api'
import type { ApiClientLoader } from './api'
import { apiCall } from './api-failure'

/** `AccountApi` over the typed client. */
export class RealAccountApi implements AccountApi {
  constructor(private readonly client: ApiClientLoader) {}

  async updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('me.update', { body: input }))
    return data
  }

  async changePassword(input: { currentPassword: string; password: string }): Promise<void> {
    const api = await this.client()
    await apiCall(() => api.request('me.password', { body: input }))
  }

  async exportData(): Promise<AccountExport> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('me.export', {}))
    return data
  }

  async deleteAccount(password: string): Promise<void> {
    const api = await this.client()
    await apiCall(() => api.request('me.delete', { body: { password } }))
  }
}
