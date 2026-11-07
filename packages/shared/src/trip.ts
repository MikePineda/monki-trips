import type { BudgetMode } from './budget_mode.ts'
import type { TripMemberRole } from './trip_member_role.ts'

/** A trip as the API returns it. Dates are `YYYY-MM-DD`; money is integer minor units. */
export interface Trip {
  id: string
  name: string
  /** ISO 4217 code, uppercase. */
  baseCurrency: string
  budgetMode: BudgetMode
  budgetTotalMinor: number | null
  startsOn: string
  endsOn: string
  /** IANA time zone the trip starts from. */
  homeTz: string
  createdBy: string | null
  /** ISO instant while the trip is soft-deleted (restorable), else null. */
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

/** A trip in the signed-in person's list, with their own role in it. */
export interface TripListItem extends Trip {
  role: TripMemberRole
  memberCount: number
}

/** Body of `POST /api/v1/trips`. `id` is a client-generated UUID and makes the call idempotent. */
export interface CreateTripInput {
  id?: string
  name: string
  baseCurrency: string
  startsOn: string
  endsOn: string
  homeTz?: string
  budgetMode?: BudgetMode
  budgetTotalMinor?: number | null
}
