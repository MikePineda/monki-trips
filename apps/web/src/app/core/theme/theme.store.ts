import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

/** localStorage key of an explicit theme; absent = follow the device (public/theme-boot.js reads it too). */
export const THEME_STORAGE_KEY = 'mt:theme'

const DARK_SCHEME = '(prefers-color-scheme: dark)'

/**
 * The colour theme: an explicit light or dark choice, or the device scheme.
 * Applied as `data-theme` on <html> (src/styles.css keys its dark tokens on
 * it; no attribute = prefers-color-scheme) and persisted so theme-boot.js
 * can apply it before the first paint. Storage may be blocked: the choice
 * then lasts for this visit only.
 */
@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly document = inject(DOCUMENT)
  private readonly view = this.document.defaultView
  private readonly current = signal<ThemePreference>('system')
  private readonly deviceDark = signal(false)

  readonly preference = this.current.asReadonly()

  /** What the page shows right now. */
  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.current()
    if (preference === 'system') {
      return this.deviceDark() ? 'dark' : 'light'
    }
    return preference
  })

  constructor() {
    this.watchDevice()
    this.apply(this.read())
  }

  set(preference: ThemePreference): void {
    this.apply(preference)
    this.write(preference)
  }

  private apply(preference: ThemePreference): void {
    this.current.set(preference)
    const root = this.document.documentElement
    if (preference === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', preference)
    }
  }

  private watchDevice(): void {
    const media = this.view?.matchMedia?.(DARK_SCHEME)
    if (!media) {
      return
    }
    this.deviceDark.set(media.matches)
    media.addEventListener?.('change', (event) => this.deviceDark.set(event.matches))
  }

  private read(): ThemePreference {
    try {
      const stored = this.view?.localStorage.getItem(THEME_STORAGE_KEY)
      return stored === 'light' || stored === 'dark' ? stored : 'system'
    } catch {
      return 'system'
    }
  }

  private write(preference: ThemePreference): void {
    try {
      if (preference === 'system') {
        this.view?.localStorage.removeItem(THEME_STORAGE_KEY)
      } else {
        this.view?.localStorage.setItem(THEME_STORAGE_KEY, preference)
      }
    } catch {
      // Storage blocked: the choice lasts for this visit only.
    }
  }
}
