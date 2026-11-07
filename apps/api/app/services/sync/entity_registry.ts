import type { SyncEntity, SyncPushEntity } from '@monkitrips/shared'
import type { EntitySpec } from '#services/sync/entity_spec'
import { budgetCategoryEntity } from '#services/sync/entities/budget_category_entity'
import { documentEntity } from '#services/sync/entities/document_entity'
import { emergencyEntity } from '#services/sync/entities/emergency_entity'
import { eventEntity } from '#services/sync/entities/event_entity'
import { expenseEntity } from '#services/sync/entities/expense_entity'
import { expenseShareEntity } from '#services/sync/entities/expense_share_entity'
import { memberEntity, phraseCardEntity } from '#services/sync/entities/read_only_entities'
import { seatEntity } from '#services/sync/entities/seat_entity'
import { segmentEntity } from '#services/sync/entities/segment_entity'
import { stopEntity } from '#services/sync/entities/stop_entity'
import { taskEntity } from '#services/sync/entities/task_entity'
import { travellerEntity } from '#services/sync/entities/traveller_entity'
import { tripEntity } from '#services/sync/entities/trip_entity'

/** Every entity push accepts, by name. */
export const PUSH_ENTITIES: Record<SyncPushEntity, EntitySpec> = {
  trip: tripEntity,
  traveller: travellerEntity,
  stop: stopEntity,
  event: eventEntity,
  segment: segmentEntity,
  seat: seatEntity,
  document: documentEntity,
  task: taskEntity,
  budget_category: budgetCategoryEntity,
  expense: expenseEntity,
  expense_share: expenseShareEntity,
  emergency: emergencyEntity,
}

/**
 * Every entity pull returns, in the order a client should apply a snapshot
 * (parents before children: trip, people, stops, events, segments, seats...).
 */
export const PULL_ENTITIES: Record<SyncEntity, EntitySpec> = {
  trip: tripEntity,
  member: memberEntity,
  traveller: travellerEntity,
  stop: stopEntity,
  event: eventEntity,
  segment: segmentEntity,
  seat: seatEntity,
  document: documentEntity,
  task: taskEntity,
  budget_category: budgetCategoryEntity,
  expense: expenseEntity,
  expense_share: expenseShareEntity,
  emergency: emergencyEntity,
  phrase_card: phraseCardEntity,
}
