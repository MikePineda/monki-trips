import { randomUUID } from 'node:crypto'
import type { E2eAccount } from './accounts.ts'
import { ApiSession } from './api-session.ts'

export interface NarrowTrip {
  tripId: string
  startsOn: string
  endsOn: string
}

/** `YYYY-MM-DD`, `days` from today in UTC. */
export function isoDay(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * A synthetic trip that stresses a narrow screen: 18 days that start 82
 * days from now (so "today" is before the trip and 100 days from its end),
 * base AUD with four-digit amounts and one expense in THB (so the
 * dollar reads `A$`), category budgets, a lodging with a long
 * name and an overnight train with a long title. Invented places only.
 */
export async function seedNarrowTrip(account: E2eAccount): Promise<NarrowTrip> {
  const api = await ApiSession.signIn(account)
  try {
    await api.deleteAllTrips()
    const startsOn = isoDay(82)
    const endsOn = isoDay(99)
    const tripId = await api.createTrip({
      name: 'Long loop',
      startsOn,
      endsOn,
      baseCurrency: 'AUD',
    })
    const snapshot = await api.snapshot(tripId)
    const category = (key: string) => {
      const found = snapshot.budgetCategories.find((row) => row.key === key)
      if (!found) throw new Error(`no default category ${key}`)
      return found.id
    }
    const stay = (offset: number) => isoDay(82 + offset)
    await api.push(tripId, [
      { entity: 'trip', id: tripId, changes: { budgetTotalMinor: 794_860 } },
      {
        entity: 'budget_category',
        id: category('accommodation'),
        changes: { budgetMinor: 320_000 },
      },
      { entity: 'budget_category', id: category('transport'), changes: { budgetMinor: 210_000 } },
      { entity: 'budget_category', id: category('food'), changes: { budgetMinor: 145_000 } },
      { entity: 'budget_category', id: category('activities'), changes: { budgetMinor: 90_000 } },
      {
        entity: 'expense',
        id: randomUUID(),
        changes: {
          amountMinor: 169_548,
          currency: 'AUD',
          spentOn: isoDay(-3),
          description: 'Flights',
          categoryId: category('transport'),
        },
      },
      {
        entity: 'expense',
        id: randomUUID(),
        changes: {
          amountMinor: 128_000,
          currency: 'AUD',
          spentOn: isoDay(-2),
          description: 'Riverside guesthouse deposit',
          categoryId: category('accommodation'),
        },
      },
      {
        // 4,500 THB at the test FX provider's 22.5 per AUD: A$200.00.
        entity: 'expense',
        id: randomUUID(),
        changes: {
          amountMinor: 450_000,
          currency: 'THB',
          spentOn: isoDay(-1),
          description: 'Cooking class',
          categoryId: category('activities'),
        },
      },
      {
        entity: 'event',
        id: randomUUID(),
        changes: {
          kind: 'lodging',
          title: 'Riverside Garden Guesthouse and Old Town Residence',
          status: 'booked',
          startsLocal: `${stay(0)}T15:00`,
          startTz: 'Asia/Bangkok',
          endsLocal: `${stay(9)}T11:00`,
          endTz: 'Asia/Bangkok',
        },
      },
      {
        entity: 'event',
        id: randomUUID(),
        changes: {
          kind: 'train',
          title: 'Train 13 Port Vellmar → Hill Town (sleeper, lower berth)',
          status: 'booked',
          startsLocal: `${stay(9)}T18:00`,
          startTz: 'Asia/Bangkok',
          endsLocal: `${stay(10)}T08:00`,
          endTz: 'Asia/Bangkok',
        },
      },
    ])
    return { tripId, startsOn, endsOn }
  } finally {
    await api.dispose()
  }
}
