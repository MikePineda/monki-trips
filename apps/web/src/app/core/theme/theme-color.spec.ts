import { TestBed } from '@angular/core/testing'
import { TOKEN_READER, ThemeColorMeta } from './theme-color'
import { ThemeStore } from './theme.store'

describe('ThemeColorMeta', () => {
  /** Token values as styles.css would resolve them for the attribute on <html>. */
  const fakeTokens = (name: string): string => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark'
    return name === '--surface-0' ? (dark ? 'rgb(17, 18, 20)' : 'rgb(247, 246, 242)') : ''
  }

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.head.querySelector('meta[name="theme-color"]')?.remove()
    TestBed.configureTestingModule({ providers: [{ provide: TOKEN_READER, useValue: fakeTokens }] })
  })

  function metaContent(): string | null {
    return document.head.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null
  }

  it('writes the light surface on start and the dark one after switching', () => {
    TestBed.inject(ThemeColorMeta)
    TestBed.tick()
    expect(metaContent()).toBe('rgb(247, 246, 242)')

    TestBed.inject(ThemeStore).set('dark')
    TestBed.tick()

    expect(metaContent()).toBe('rgb(17, 18, 20)')
  })

  it('reuses the meta element already in the head', () => {
    const existing = document.createElement('meta')
    existing.setAttribute('name', 'theme-color')
    existing.setAttribute('content', 'stale')
    document.head.append(existing)

    TestBed.inject(ThemeColorMeta)
    TestBed.tick()

    expect(document.head.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1)
    expect(existing.getAttribute('content')).toBe('rgb(247, 246, 242)')
  })
})
