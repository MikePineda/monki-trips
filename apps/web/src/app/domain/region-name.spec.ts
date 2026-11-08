import { regionName } from './region-name'

describe('regionName', () => {
  it('names a country in the language of the app', () => {
    expect(regionName('FR', 'en')).toBe('France')
    expect(regionName('FR', 'es')).toBe('Francia')
  })

  it('prefers a known name and falls back to the code', () => {
    expect(regionName('XA', 'en', 'Xaloa')).toBe('Xaloa')
    expect(regionName('XQ', 'en')).toBe('XQ')
    expect(regionName('not a code', 'en')).toBe('not a code')
  })
})
