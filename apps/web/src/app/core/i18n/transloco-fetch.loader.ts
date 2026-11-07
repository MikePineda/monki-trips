import { DOCUMENT, Injectable, inject } from '@angular/core'
import type { Translation, TranslocoLoader } from '@jsverse/transloco'

/**
 * Loads the global catalogues from /i18n/{lang}.json with fetch (no
 * HttpClient in the bundle). The API serves /i18n/* with no-cache and the
 * service worker prefetches them with the build. Scopes ship inline loaders
 * (`import()` of their own JSON) and never come through here.
 */
@Injectable({ providedIn: 'root' })
export class TranslocoFetchLoader implements TranslocoLoader {
  private readonly document = inject(DOCUMENT)

  async getTranslation(lang: string): Promise<Translation> {
    const view = this.document.defaultView
    if (!view) {
      throw new Error('No window to load translations with')
    }
    const response = await view.fetch(`/i18n/${lang}.json`)
    if (!response.ok) {
      throw new Error(`Could not load the "${lang}" catalogue (${response.status})`)
    }
    return (await response.json()) as Translation
  }
}
