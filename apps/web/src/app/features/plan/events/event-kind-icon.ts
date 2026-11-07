import type { EventKind } from '@monkitrips/shared'
import type { IconName } from '../../../shared/ui/icon/icon-names'

/** The Lucide icon of each event kind. */
export const EVENT_KIND_ICONS: Record<EventKind, IconName> = {
  flight: 'plane',
  train: 'train-front',
  ferry: 'ship',
  bus: 'bus',
  car: 'car',
  lodging: 'bed-double',
  tour: 'footprints',
  meal: 'utensils',
  activity: 'ticket',
  free_time: 'coffee',
  other: 'map-pin',
}
