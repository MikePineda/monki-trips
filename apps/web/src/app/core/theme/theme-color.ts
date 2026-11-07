import { DOCUMENT, Injectable, InjectionToken, effect, inject } from '@angular/core'
import { ThemeStore } from './theme.store'

/** Reads the current value of a CSS custom property on <html>. */
export type TokenReader = (name: string) => string

export const TOKEN_READER = new InjectionToken<TokenReader>('TOKEN_READER', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT)
    return (name) =>
      document.defaultView
        ?.getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim() ?? ''
  },
})

/**
 * Keeps `<meta name="theme-color">` equal to the page surface (`--surface-0`)
 * of the theme being shown, so the browser chrome matches in light and
 * dark. The manifest carries the light value (pwa-config.spec.ts); this
 * follows the live tokens, so no hex leaves src/styles.css.
 */
@Injectable({ providedIn: 'root' })
export class ThemeColorMeta {
  private readonly document = inject(DOCUMENT)
  private readonly readToken = inject(TOKEN_READER)
  private readonly theme = inject(ThemeStore)

  constructor() {
    effect(() => {
      this.theme.resolved()
      const colour = this.readToken('--surface-0')
      if (colour) {
        this.meta().setAttribute('content', colour)
      }
    })
  }

  private meta(): HTMLMetaElement {
    let meta = this.document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) {
      meta = this.document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      this.document.head.append(meta)
    }
    return meta
  }
}
