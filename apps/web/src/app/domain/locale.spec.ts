import { APP_LANGS, DEFAULT_LANG, formatLocaleFor, isAppLang } from './locale'

describe('locale', () => {
  it('english is the default language', () => {
    expect(DEFAULT_LANG).toBe('en')
  })

  it('every language has a format locale', () => {
    expect(APP_LANGS.map(formatLocaleFor)).toEqual(['en-AU', 'es-MX'])
  })

  it('only supported languages are app languages', () => {
    expect(isAppLang('es')).toBe(true)
    expect(isAppLang('fr')).toBe(false)
    expect(isAppLang(null)).toBe(false)
  })
})
