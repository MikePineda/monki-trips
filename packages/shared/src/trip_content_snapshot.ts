import type { TripDocument } from './document.ts'
import type { EmergencyInfo, PhraseCards } from './emergency_info.ts'
import type { EventSegment, SegmentSeat, TripEvent } from './event.ts'
import type { BudgetCategory, Expense, ExpenseShare } from './expense.ts'
import type { Stop } from './stop.ts'
import type { Task } from './task.ts'
import type { TripSnapshot } from './trip_snapshot.ts'

/**
 * What `GET /api/v1/trips/:tripId/snapshot` returns since the sync package:
 * the trip, its people and every live content row. Extends `TripSnapshot`
 * so clients typed against the smaller shape keep working.
 */
export interface TripContentSnapshot extends TripSnapshot {
  stops: Stop[]
  events: TripEvent[]
  segments: EventSegment[]
  seats: SegmentSeat[]
  documents: TripDocument[]
  tasks: Task[]
  budgetCategories: BudgetCategory[]
  expenses: Expense[]
  expenseShares: ExpenseShare[]
  emergency: EmergencyInfo | null
  phraseCards: PhraseCards[]
}
