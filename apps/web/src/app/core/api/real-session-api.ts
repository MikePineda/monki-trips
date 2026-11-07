import type { LoginInput, SessionApi, SessionUser } from '../session/session-api'
import type { ApiClientLoader } from './api'
import { ApiFailure, apiCall } from './api-failure'

/** `SessionApi` over the typed client: `/auth/me`, `/auth/login`, `/auth/logout[-all]`. */
export class RealSessionApi implements SessionApi {
  constructor(private readonly client: ApiClientLoader) {}

  async me(): Promise<SessionUser | null> {
    const api = await this.client()
    try {
      const { data } = await apiCall(() => api.request('auth.me', {}))
      return data
    } catch (error) {
      if (error instanceof ApiFailure && error.isStatus(401)) {
        return null
      }
      throw error
    }
  }

  async login(input: LoginInput): Promise<SessionUser> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('auth.login', { body: input }))
    return data
  }

  async logout(): Promise<void> {
    const api = await this.client()
    await apiCall(() => api.request('auth.logout', {}))
  }

  async logoutAll(): Promise<void> {
    const api = await this.client()
    await apiCall(() => api.request('auth.logoutAll', {}))
  }
}
