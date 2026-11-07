import { pickLocale } from './pick-locale'

describe('pickLocale', () => {
  it('picks es for es-MX device', () => {
    expect(pickLocale({ stored: null, deviceLanguages: ['es-MX', 'es'] })).toBe('es')
  })

  it('falls back to en for unsupported languages', () => {
    expect(pickLocale({ stored: null, deviceLanguages: ['th-TH', 'ja'] })).toBe('en')
    expect(pickLocale({ stored: null, deviceLanguages: [] })).toBe('en')
  })

  it('respects a stored user choice over the device', () => {
    expect(pickLocale({ stored: 'en', deviceLanguages: ['es-MX'] })).toBe('en')
    expect(pickLocale({ stored: 'es', deviceLanguages: ['en-AU'] })).toBe('es')
  })

  it('ignores a stored value that is not a supported language', () => {
    expect(pickLocale({ stored: 'fr', deviceLanguages: ['es-ES'] })).toBe('es')
  })

  it('takes the first supported language in the device preference order', () => {
    expect(pickLocale({ stored: null, deviceLanguages: ['th-TH', 'es-419', 'en-AU'] })).toBe('es')
    expect(pickLocale({ stored: null, deviceLanguages: ['en-AU', 'es-MX'] })).toBe('en')
  })

  it('matches language tags case-insensitively', () => {
    expect(pickLocale({ stored: null, deviceLanguages: ['ES-mx'] })).toBe('es')
  })
})
