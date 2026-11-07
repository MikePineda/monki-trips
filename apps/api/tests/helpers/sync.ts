import { randomUUID } from 'node:crypto'
import type { ApiClient, ApiResponse } from '@japa/api-client'
import type { SyncMutation, SyncMutationResult, SyncPushEntity } from '@monkitrips/shared'
import type User from '#models/user'
import { actingAs } from '#tests/helpers/acting_as'

/** A mutation with fresh ids; `changedAt` defaults to the fixed clock's "now" of the specs. */
export function mutation(
  tripId: string,
  entity: SyncPushEntity,
  changes: Record<string, unknown>,
  overrides: Partial<SyncMutation> = {}
): SyncMutation {
  return {
    mutationId: randomUUID(),
    tripId,
    entity,
    op: 'upsert',
    id: randomUUID(),
    changes,
    changedAt: '2026-11-07T10:00:00.000Z',
    ...overrides,
  }
}

/** `POST /sync/push` with one batch, asserting the request itself was accepted. */
export async function push(
  client: ApiClient,
  user: User,
  mutations: SyncMutation[]
): Promise<SyncMutationResult[]> {
  const response: ApiResponse = await actingAs(client.post('/api/v1/sync/push'), user).json({
    mutations,
  })
  response.assertStatus(200)
  return response.body().data.results
}

/** Pushes one mutation and returns its result. */
export async function pushOne(
  client: ApiClient,
  user: User,
  one: SyncMutation
): Promise<SyncMutationResult> {
  const [result] = await push(client, user, [one])
  return result
}

/** Pushes one mutation that must apply cleanly and returns the server row. */
export async function pushApplied<T = Record<string, unknown>>(
  client: ApiClient,
  user: User,
  one: SyncMutation
): Promise<T> {
  const result = await pushOne(client, user, one)
  if (result.status !== 'applied') {
    throw new Error(
      `expected applied, got ${result.status}: ${JSON.stringify(result.error ?? result.rejectedFields)}`
    )
  }
  return result.row as T
}

/** `GET /sync/pull` for `user`. */
export async function pull(
  client: ApiClient,
  user: User,
  query: { cursor?: string; limit?: number } = {}
): Promise<ApiResponse> {
  return actingAs(client.get('/api/v1/sync/pull'), user).qs(query)
}
