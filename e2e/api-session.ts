import { request, type APIRequestContext, type APIResponse } from '@playwright/test'
import type { E2eAccount } from './accounts.ts'

/**
 * A signed-in session against the API under test, without a browser: for
 * arranging and cleaning data around a journey. It follows the contract
 * like the app does: `GET /config` hands out the XSRF-TOKEN cookie, and
 * every write echoes it in `X-XSRF-TOKEN`.
 */
export class ApiSession {
  private constructor(private readonly context: APIRequestContext) {}

  static async signIn(account: E2eAccount): Promise<ApiSession> {
    const port = process.env.PORT
    if (!port) {
      throw new Error('PORT is not set: run the suite through scripts/e2e.sh')
    }
    const context = await request.newContext({ baseURL: `http://127.0.0.1:${port}` })
    const session = new ApiSession(context)
    await session.expectOk(await context.get('/api/v1/config'), 'GET /config')
    await session.write('post', '/api/v1/auth/login', {
      email: account.email,
      password: account.password,
    })
    return session
  }

  /** Ids of the account's live trips. */
  async tripIds(): Promise<string[]> {
    const response = await this.context.get('/api/v1/trips')
    await this.expectOk(response, 'GET /trips')
    const body = (await response.json()) as { data: { id: string }[] }
    return body.data.map((trip) => trip.id)
  }

  /** Soft-deletes every trip the account owns, so a journey starts from an empty list. */
  async deleteAllTrips(): Promise<void> {
    for (const id of await this.tripIds()) {
      await this.write('delete', `/api/v1/trips/${id}`)
    }
  }

  /** Sends the test notification to every device of the account and reports what happened. */
  async sendPushTest(): Promise<{ sent: number; pruned: number; failed: number }> {
    const response = await this.write('post', '/api/v1/me/push-subscriptions/test')
    const body = (await response.json()) as {
      data: { sent: number; pruned: number; failed: number }
    }
    return body.data
  }

  async dispose(): Promise<void> {
    await this.context.dispose()
  }

  private async write(
    method: 'post' | 'delete',
    path: string,
    data?: unknown
  ): Promise<APIResponse> {
    const cookies = (await this.context.storageState()).cookies
    const xsrf = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? ''
    const response = await this.context[method](path, {
      data,
      headers: { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) },
    })
    await this.expectOk(response, `${method.toUpperCase()} ${path}`)
    return response
  }

  private async expectOk(
    response: { ok(): boolean; status(): number },
    what: string
  ): Promise<void> {
    if (!response.ok()) {
      throw new Error(`${what} answered ${response.status()}`)
    }
  }
}
