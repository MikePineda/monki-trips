import { randomUUID } from 'node:crypto'
import { request, type APIRequestContext, type APIResponse } from '@playwright/test'
import type { E2eAccount } from './accounts.ts'

/** The parts of the snapshot the journeys read (the full shape lives in @monkitrips/shared). */
export interface TripContentSnapshotLike {
  tasks: {
    id: string
    title: string
    doneAt: string | null
    origin: string
    sourceDocumentId?: string | null
  }[]
  documents: {
    id: string
    title: string
    kind: string
    tags: string[]
    sha256: string | null
    eventId?: string | null
  }[]
  emergency: { content: Record<string, unknown> } | null
  stops: { id: string; name: string; tz: string | null }[]
  events: { id: string; kind: string; title: string; startsOn: string | null }[]
  budgetCategories: { id: string; key: string | null; budgetMinor: number | null }[]
  expenses: {
    id: string
    amountMinor: number
    currency: string
    fxRate: string | null
    baseAmountMinor: number | null
    needsDetails: boolean
  }[]
}

/** `NotificationSettings` of @monkitrips/shared: which reminders the account gets, quiet hours `HH:MM`. */
export interface NotificationSettingsLike {
  leaveAt: boolean
  checkOut: boolean
  tasksDue: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
}

/** One `/sync/push` mutation without the bookkeeping (`mutationId`, `tripId`, `changedAt`; `op` defaults to upsert). */
export interface SeedMutation {
  entity: string
  id: string
  op?: 'upsert' | 'delete'
  changes: Record<string, unknown>
}

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

  /** Creates a trip for the account and answers its id. */
  async createTrip(input: {
    name: string
    startsOn: string
    endsOn: string
    baseCurrency: string
  }): Promise<string> {
    const response = await this.write('post', '/api/v1/trips', input)
    const body = (await response.json()) as { data: { id: string } }
    return body.data.id
  }

  /**
   * Generates the trip's phrase cards in one language (`POST
   * /trips/:tripId/phrase-cards`; the suite's API answers from the fake
   * LLM) and answers how many cards the set holds.
   */
  async generatePhraseCards(tripId: string, language: string): Promise<number> {
    const response = await this.write('post', `/api/v1/trips/${tripId}/phrase-cards`, {
      language,
    })
    const body = (await response.json()) as { data: { cards: unknown[] } }
    return body.data.cards.length
  }

  /** The trip's live content as the API sees it (tasks, emergency information...). */
  async snapshot(tripId: string): Promise<TripContentSnapshotLike> {
    const response = await this.context.get(`/api/v1/trips/${tripId}/snapshot`)
    await this.expectOk(response, 'GET /trips/:tripId/snapshot')
    const body = (await response.json()) as { data: TripContentSnapshotLike }
    return body.data
  }

  /** Who owes whom on the trip (`GET /trips/:tripId/balances`), minor units as numbers. */
  async balances(tripId: string): Promise<{
    balances: { travellerId: string; displayName: string | null; netMinor: number }[]
    settlements: { fromTravellerId: string; toTravellerId: string; amountMinor: number }[]
  }> {
    const response = await this.context.get(`/api/v1/trips/${tripId}/balances`)
    await this.expectOk(response, 'GET /trips/:tripId/balances')
    const body = (await response.json()) as {
      data: Awaited<ReturnType<ApiSession['balances']>>
    }
    return body.data
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

  /** Replaces the account's reminder settings (`PUT /me/notification-settings`). */
  async saveNotificationSettings(settings: NotificationSettingsLike): Promise<void> {
    await this.write('put', '/api/v1/me/notification-settings', settings)
  }

  /** The account's reminder settings as the API stores them. */
  async notificationSettings(): Promise<NotificationSettingsLike> {
    const response = await this.context.get('/api/v1/me/notification-settings')
    await this.expectOk(response, 'GET /me/notification-settings')
    const body = (await response.json()) as { data: NotificationSettingsLike }
    return body.data
  }

  /**
   * Writes trip content the way the app does, through `POST /sync/push`;
   * fails when a mutation is not applied.
   */
  async push(tripId: string, mutations: SeedMutation[]): Promise<void> {
    const changedAt = new Date().toISOString()
    const response = await this.write('post', '/api/v1/sync/push', {
      mutations: mutations.map((mutation) => ({
        mutationId: randomUUID(),
        tripId,
        op: 'upsert',
        changedAt,
        ...mutation,
      })),
    })
    const body = (await response.json()) as {
      data: { results: { status: string; error?: { code: string } }[] }
    }
    const refused = body.data.results.filter((result) => result.status !== 'applied')
    if (refused.length > 0) {
      throw new Error(`sync push refused: ${JSON.stringify(refused)}`)
    }
  }

  /** Issues an invitation by link and answers its token (the response is the only place it shows). */
  async createInvitationLink(tripId: string): Promise<string> {
    const response = await this.write('post', `/api/v1/trips/${tripId}/invitations`, {})
    const body = (await response.json()) as { data: { token: string } }
    return body.data.token
  }

  /** Uploads a file document (multipart, like the documents screen) and answers its id. */
  async uploadDocument(
    tripId: string,
    file: { name: string; mimeType: string; buffer: Buffer },
    fields: { title?: string; eventId?: string } = {}
  ): Promise<string> {
    const id = randomUUID()
    const response = await this.context.post(`/api/v1/trips/${tripId}/documents`, {
      multipart: { file, id, ...fields },
      headers: { 'X-XSRF-TOKEN': await this.xsrf() },
    })
    await this.expectOk(response, 'POST /trips/:tripId/documents')
    return id
  }

  /** The session's cookies as one `Cookie` header, for a tool that cannot sign in (Lighthouse). */
  async cookieHeader(): Promise<string> {
    const cookies = (await this.context.storageState()).cookies
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
  }

  async dispose(): Promise<void> {
    await this.context.dispose()
  }

  private async write(
    method: 'post' | 'put' | 'delete',
    path: string,
    data?: unknown
  ): Promise<APIResponse> {
    const response = await this.context[method](path, {
      data,
      headers: { 'X-XSRF-TOKEN': await this.xsrf() },
    })
    await this.expectOk(response, `${method.toUpperCase()} ${path}`)
    return response
  }

  private async xsrf(): Promise<string> {
    const cookies = (await this.context.storageState()).cookies
    return decodeURIComponent(cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? '')
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
