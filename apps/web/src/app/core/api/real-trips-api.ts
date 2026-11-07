import type {
  CreateTripInput,
  IssuedTripInvitation,
  Trip,
  TripListItem,
  TripMember,
  TripSnapshot,
} from '@monkitrips/shared'
import type { ApiClientLoader } from './api'
import { ApiFailure, apiCall } from './api-failure'
import type { TripsApi } from './trips-api'

/** `TripsApi` over the typed client. */
export class RealTripsApi implements TripsApi {
  constructor(private readonly client: ApiClientLoader) {}

  async list(): Promise<TripListItem[]> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('trips.index', {}))
    return data
  }

  async create(input: CreateTripInput): Promise<Trip> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('trips.store', { body: input }))
    return data
  }

  async snapshot(tripId: string): Promise<TripSnapshot | null> {
    const api = await this.client()
    try {
      const { data } = await apiCall(() => api.request('trips.snapshot', { params: { tripId } }))
      return data
    } catch (error) {
      if (error instanceof ApiFailure && error.isStatus(404)) {
        return null
      }
      throw error
    }
  }

  async members(tripId: string): Promise<TripMember[]> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('trips.members.index', { params: { tripId } }))
    return data
  }

  async inviteByLink(tripId: string): Promise<IssuedTripInvitation> {
    const api = await this.client()
    const { data } = await apiCall(() =>
      api.request('trips.invitations.store', { params: { tripId }, body: {} })
    )
    return data
  }
}
