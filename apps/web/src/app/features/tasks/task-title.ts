import { PRINT_DOCUMENT_TASK_KEY } from '@monkitrips/shared'
import { PRE_TRIP_TEMPLATE, templateTitleKey } from '../../domain/pre-trip-template'
import type { TaskRecord } from '../../core/offline/records'

/** The `tasks` catalogue keys a generated task may carry (`titleKey`). */
const KNOWN_TITLE_KEYS = new Set<string>([
  `titleKey.${PRINT_DOCUMENT_TASK_KEY}`,
  ...PRE_TRIP_TEMPLATE.map((item) => templateTitleKey(item.key)),
])

/**
 * The catalogue key that renders a task's title, with `title` as the
 * `{{title}}` parameter: `tasks.titleKey.print_document` for the API's
 * print tasks, `tasks.template.<item>` for checklist items. Null for a
 * task whose title is the text itself (or an unknown key: the stored
 * title is the honest fallback). Pure.
 */
export function taskTitleKey(task: Pick<TaskRecord, 'titleKey'>): string | null {
  if (!task.titleKey) {
    return null
  }
  const key = task.titleKey.includes('.') ? task.titleKey : `titleKey.${task.titleKey}`
  return KNOWN_TITLE_KEYS.has(key) ? `tasks.${key}` : null
}
