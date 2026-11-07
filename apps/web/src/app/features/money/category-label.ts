import { DEFAULT_BUDGET_CATEGORY_KEYS } from '@monkitrips/shared'

/** The `money` scope keys of the default categories, in `DEFAULT_BUDGET_CATEGORY_KEYS` order. */
export const CATEGORY_LABEL_KEYS: readonly string[] = DEFAULT_BUDGET_CATEGORY_KEYS.map(
  (key) => `category.${key}`
)

/**
 * The name a budget line shows: a default category (`key`) in the active
 * language, a custom one by its own `name`. `labels` are the translations
 * of `CATEGORY_LABEL_KEYS`, in order; an unknown key shows as written.
 */
export function categoryLabel(
  category: { key: string | null; name: string | null },
  labels: readonly string[]
): string {
  if (category.key) {
    const index = (DEFAULT_BUDGET_CATEGORY_KEYS as readonly string[]).indexOf(category.key)
    return (index >= 0 ? labels[index] : '') || category.name || category.key
  }
  return category.name ?? ''
}
