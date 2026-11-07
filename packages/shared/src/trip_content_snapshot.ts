import type { TripDocumentRow } from './document.ts'
import type { EmergencyInfo, PhraseCards } from './emergency_info.ts'
import type { EventSegmentRow, SegmentSeat, TripEventRow } from './event.ts'
import type { BudgetCategory, Expense, ExpenseShare } from './expense.ts'
import type { TripStopRow } from './stop.ts'
import type { TripTaskRow } from './task.ts'
import type { TripSnapshot } from './trip_snapshot.ts'

/**
 * What `GET /api/v1/trips/:tripId/snapshot` returns since the sync package:
 * the trip, its people and every live content row. Extends `TripSnapshot`
 * so clients typed against the smaller shape keep working.
 */
export interface TripContentSnapshot extends TripSnapshot {
  stops: TripStopRow[]
  events: TripEventRow[]
  segments: EventSegmentRow[]
  seats: SegmentSeat[]
  documents: TripDocumentRow[]
  tasks: TripTaskRow[]
  budgetCategories: BudgetCategory[]
  expenses: Expense[]
  expenseShares: ExpenseShare[]
  emergency: EmergencyInfo | null
  phraseCards: PhraseCards[]
}
