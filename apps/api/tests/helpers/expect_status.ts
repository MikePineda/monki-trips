import type { ApiResponse } from '@japa/api-client'

/** Awaits a request and asserts its status in one expression, for one-line arrange steps. */
export async function expectStatus(
  request: PromiseLike<ApiResponse>,
  status: number
): Promise<ApiResponse> {
  const response = await request
  response.assertStatus(status)
  return response
}
