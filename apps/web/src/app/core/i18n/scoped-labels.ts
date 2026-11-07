import { inject, type Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { TRANSLOCO_SCOPE, TranslocoService, type TranslocoScope } from '@jsverse/transloco'

/**
 * Translated strings for code (option labels, status words) from one of the
 * scopes the component provides, as a signal that follows the language and
 * the lazy catalogue: `translate()` before the catalogue has loaded would
 * hand back the raw key. A component that provides several scopes gets them
 * as a list from `TRANSLOCO_SCOPE`, so the scope is picked by name.
 */
export function scopedLabels(scopeName: string, keys: readonly string[]): Signal<string[]> {
  const transloco = inject(TranslocoService)
  const provided = inject(TRANSLOCO_SCOPE)
  const scopes = (Array.isArray(provided) ? provided : [provided]) as TranslocoScope[]
  const scope = scopes.find((item) => typeof item === 'object' && item?.scope === scopeName)
  return toSignal(transloco.selectTranslate<string[]>([...keys], {}, scope), {
    initialValue: keys.map(() => ''),
  })
}
