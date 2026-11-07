/**
 * The pre-trip checklist template: documents, gear and the day before
 * leaving. Every item becomes an ordinary task of the trip (origin
 * `template`, `templateItemKey` = the item key) with a due date relative to
 * departure. The item key is stable across languages; the title comes from
 * the `tasks` catalogue of each side (`template.<key>`, stored as the
 * task's `titleKey`). The API and the web app share this one list, so a
 * checklist made offline and one made by `POST /trips/:tripId/tasks/from-template`
 * reconcile by key. Pure.
 */
import { addDays, type IsoDate } from './iso_date.ts'
import type { TaskPriority } from './trip_task.ts'

export const TEMPLATE_CATEGORIES = ['documents', 'gear', 'before_leaving'] as const

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

export interface TemplateItem {
  /** `<category>.<item>`, the task's `templateItemKey`. */
  key: string
  category: TemplateCategory
  priority: TaskPriority
  /** Days before departure the item is due (0 = the departure day). */
  daysBefore: number
}

export const PRE_TRIP_TEMPLATE: readonly TemplateItem[] = [
  { key: 'documents.passport', category: 'documents', priority: 'high', daysBefore: 60 },
  { key: 'documents.visa', category: 'documents', priority: 'high', daysBefore: 45 },
  { key: 'documents.insurance', category: 'documents', priority: 'normal', daysBefore: 14 },
  { key: 'gear.esim', category: 'gear', priority: 'normal', daysBefore: 7 },
  { key: 'gear.adapter', category: 'gear', priority: 'low', daysBefore: 7 },
  { key: 'gear.cash', category: 'gear', priority: 'normal', daysBefore: 3 },
  { key: 'before_leaving.print', category: 'before_leaving', priority: 'high', daysBefore: 1 },
]

/** The item keys in template order: what a `templateItemKey` may be. */
export const PRE_TRIP_TEMPLATE_KEYS: readonly string[] = PRE_TRIP_TEMPLATE.map((item) => item.key)

/** The translation key of an item's title in the `tasks` scope. */
export function templateTitleKey(itemKey: string): string {
  return `template.${itemKey}`
}

export interface TemplateTask {
  item: TemplateItem
  titleKey: string
  dueOn: IsoDate
}

/**
 * The items still missing from a trip, with their due dates: adding the
 * template twice adds nothing the second time (idempotent by item key).
 */
export function missingTemplateTasks(
  startsOn: IsoDate,
  presentKeys: Iterable<string | null | undefined>
): TemplateTask[] {
  const present = new Set(presentKeys)
  return PRE_TRIP_TEMPLATE.filter((item) => !present.has(item.key)).map((item) => ({
    item,
    titleKey: templateTitleKey(item.key),
    dueOn: addDays(startsOn, -item.daysBefore),
  }))
}

/** The template item of a task's key, if the key is one of ours. */
export function templateItem(key: string | null | undefined): TemplateItem | undefined {
  return PRE_TRIP_TEMPLATE.find((item) => item.key === key)
}
