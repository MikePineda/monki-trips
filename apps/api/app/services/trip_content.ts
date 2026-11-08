import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import type {
  BudgetCategory,
  EmergencyInfo,
  EventSegmentRow,
  Expense,
  ExpenseShare,
  PhraseCards,
  SegmentSeat,
  TripStopRow,
  TripTaskRow,
  TripDocumentRow,
  TripEventRow,
} from '@monkitrips/shared'
import { PULL_ENTITIES } from '#services/sync/entity_registry'
import type { DbRow, EntitySpec } from '#services/sync/entity_spec'
import { rowToWire } from '#services/sync/row_wire'

/** Every live content row of one trip, in wire shape. */
export interface TripContentRows {
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

/** Reads the live content of a trip through the same specs sync uses, so the views and the snapshot see what the client sees. */
export class TripContent {
  /** `client` reads inside a transaction (the assistant's dry run sees its own uncommitted writes). */
  async load(
    tripId: string,
    client: QueryClientContract | TransactionClientContract = db.connection()
  ): Promise<TripContentRows> {
    const rows = <T>(spec: EntitySpec, order: string[]) => this.rows<T>(client, spec, tripId, order)
    // One query at a time: inside a transaction the connection is shared.
    const stops = await rows<TripStopRow>(PULL_ENTITIES.stop, ['position', 'arrive_on'])
    const events = await rows<TripEventRow>(PULL_ENTITIES.event, ['starts_at', 'created_at'])
    const segments = await rows<EventSegmentRow>(PULL_ENTITIES.segment, ['event_id', 'position'])
    const seats = await rows<SegmentSeat>(PULL_ENTITIES.seat, ['segment_id', 'created_at'])
    const documents = await rows<TripDocumentRow>(PULL_ENTITIES.document, ['created_at'])
    const tasks = await rows<TripTaskRow>(PULL_ENTITIES.task, ['due_on', 'created_at'])
    const budgetCategories = await rows<BudgetCategory>(PULL_ENTITIES.budget_category, ['position'])
    const expenses = await rows<Expense>(PULL_ENTITIES.expense, ['spent_on', 'created_at'])
    const expenseShares = await rows<ExpenseShare>(PULL_ENTITIES.expense_share, [
      'expense_id',
      'created_at',
    ])
    const emergency = await rows<EmergencyInfo>(PULL_ENTITIES.emergency, [])
    const phraseCards = await rows<PhraseCards>(PULL_ENTITIES.phrase_card, ['language'])
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

  private async rows<T>(
    client: QueryClientContract | TransactionClientContract,
    spec: EntitySpec,
    tripId: string,
    order: string[]
  ): Promise<T[]> {
    let query = client.from(spec.table).where(spec.tripColumn, tripId).whereNull('deleted_at')
    for (const column of order) query = query.orderBy(column, 'asc')
    const rows = (await query) as DbRow[]
    return rows.map((row) => rowToWire(spec, row) as T)
  }
}
