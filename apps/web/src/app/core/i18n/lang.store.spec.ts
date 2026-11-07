import { DOCUMENT } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { TranslocoService } from '@jsverse/transloco'
import { i18nTesting } from '../../../testing/i18n-testing'
import { LANG_STORAGE_KEY, LangStore } from './lang.store'

function setup(languages: string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages)
  TestBed.configureTestingModule({ imports: [i18nTesting()] })
  return {
    store: TestBed.inject(LangStore),
    transloco: TestBed.inject(TranslocoService),
    document: TestBed.inject(DOCUMENT),
  }
}

describe('LangStore', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('first run follows the device and remembers the choice', () => {
    const { store, transloco, document } = setup(['es-MX', 'es'])

    store.init()

    expect(store.lang()).toBe('es')
    expect(transloco.getActiveLang()).toBe('es')
    expect(document.documentElement.lang).toBe('es-MX')
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('es')
  })

  it('a stored choice wins over the device', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'en')
    const { store } = setup(['es-MX'])

    store.init()

    expect(store.lang()).toBe('en')
  })

  it('choosing a language switches the UI and persists it', () => {
    const { store, transloco } = setup(['en-AU'])
    store.init()

    store.use('es')

    expect(transloco.getActiveLang()).toBe('es')
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('es')
  })

  it('blocked storage still picks a language from the device', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { store } = setup(['es-AR'])

    store.init()

    expect(store.lang()).toBe('es')
  })
})
