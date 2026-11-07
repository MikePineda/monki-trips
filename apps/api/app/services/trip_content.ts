import db from '@adonisjs/lucid/services/db'
import type {
  BudgetCategory,
  EmergencyInfo,
  EventSegment,
  Expense,
  ExpenseShare,
  PhraseCards,
  SegmentSeat,
  Stop,
  Task,
  TripDocument,
  TripEvent,
} from '@monkitrips/shared'
import { PULL_ENTITIES } from '#services/sync/entity_registry'
import type { DbRow, EntitySpec } from '#services/sync/entity_spec'
import { rowToWire } from '#services/sync/row_wire'

/** Every live content row of one trip, in wire shape. */
export interface TripContentRows {
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

/** Reads the live content of a trip through the same specs sync uses, so the views and the snapshot see what the client sees. */
export class TripContent {
  async load(tripId: string): Promise<TripContentRows> {
    // One query at a time: inside a transaction the connection is shared.
    const stops = await this.rows<Stop>(PULL_ENTITIES.stop, tripId, ['position', 'arrive_on'])
    const events = await this.rows<TripEvent>(PULL_ENTITIES.event, tripId, [
      'starts_at',
      'created_at',
    ])
    const segments = await this.rows<EventSegment>(PULL_ENTITIES.segment, tripId, [
      'event_id',
      'position',
    ])
    const seats = await this.rows<SegmentSeat>(PULL_ENTITIES.seat, tripId, [
      'segment_id',
      'created_at',
    ])
    const documents = await this.rows<TripDocument>(PULL_ENTITIES.document, tripId, ['created_at'])
    const tasks = await this.rows<Task>(PULL_ENTITIES.task, tripId, ['due_on', 'created_at'])
    const budgetCategories = await this.rows<BudgetCategory>(
      PULL_ENTITIES.budget_category,
      tripId,
      ['position']
    )
    const expenses = await this.rows<Expense>(PULL_ENTITIES.expense, tripId, [
      'spent_on',
      'created_at',
    ])
    const expenseShares = await this.rows<ExpenseShare>(PULL_ENTITIES.expense_share, tripId, [
      'expense_id',
      'created_at',
    ])
    const emergency = await this.rows<EmergencyInfo>(PULL_ENTITIES.emergency, tripId, [])
    const phraseCards = await this.rows<PhraseCards>(PULL_ENTITIES.phrase_card, tripId, [
      'language',
    ])
    return {
      stops,
      events,
      segments,
      seats,
      documents,
      tasks,
      budgetCategories,
      expenses,
      expenseShares,
      emergency: emergency[0] ?? null,
      phraseCards,
    }
  }

  private async rows<T>(spec: EntitySpec, tripId: string, order: string[]): Promise<T[]> {
    let query = db.from(spec.table).where(spec.tripColumn, tripId).whereNull('deleted_at')
    for (const column of order) query = query.orderBy(column, 'asc')
    const rows = (await query) as DbRow[]
    return rows.map((row) => rowToWire(spec, row) as T)
  }
}
