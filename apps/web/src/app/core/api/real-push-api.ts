import type {
  PushSubscription,
  PushTestResult,
  RegisterPushSubscriptionInput,
} from '@monkitrips/shared'
import type { ApiClientLoader } from './api'
import { apiCall } from './api-failure'
import type { PushApi } from './push-api'

/** `PushApi` over the typed client. */
export class RealPushApi implements PushApi {
  constructor(private readonly client: ApiClientLoader) {}

  async register(input: RegisterPushSubscriptionInput): Promise<PushSubscription> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('me.pushSubscriptions.store', { body: input }))
    return data
  }

  async unregister(id: string): Promise<void> {
    const api = await this.client()
    await apiCall(() => api.request('me.pushSubscriptions.destroy', { params: { id } }))
  }

  async sendTest(): Promise<PushTestResult> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('me.pushSubscriptions.test', {}))
    return data
  }
}
