import { TestBed } from '@angular/core/testing'
import { THEME_STORAGE_KEY, ThemeStore } from './theme.store'

describe('ThemeStore', () => {
  let listeners: ((event: { matches: boolean }) => void)[]
  let deviceDark: boolean

  function stubMatchMedia(dark: boolean) {
    deviceDark = dark
    listeners = []
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('dark') && deviceDark,
      media: query,
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
        listeners.push(listener),
    }))
  }

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    stubMatchMedia(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute('data-theme')
  })

  it('follows the device by default: no attribute, resolved from the scheme', () => {
    stubMatchMedia(true)
    const store = TestBed.inject(ThemeStore)

    expect(store.preference()).toBe('system')
    expect(store.resolved()).toBe('dark')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('an explicit choice is applied as data-theme and remembered like theme-boot.js reads it', () => {
    const store = TestBed.inject(ThemeStore)

    store.set('dark')

    expect(store.resolved()).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('restores the stored choice on start', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    stubMatchMedia(true)

    const store = TestBed.inject(ThemeStore)

    expect(store.preference()).toBe('light')
    expect(store.resolved()).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('going back to system removes the attribute and the stored key', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    const store = TestBed.inject(ThemeStore)

    store.set('system')

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('a device scheme change updates the resolved theme while following the system', () => {
    const store = TestBed.inject(ThemeStore)
    expect(store.resolved()).toBe('light')

    for (const listener of listeners) {
      listener({ matches: true })
    }

    expect(store.resolved()).toBe('dark')
  })

  it('ignores garbage in storage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon')

    expect(TestBed.inject(ThemeStore).preference()).toBe('system')
  })
})
