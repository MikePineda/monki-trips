import {
  PHRASE_CARD_LANGUAGES,
  destinationLanguage,
  languageForCountry,
} from './phrase-card-languages'

const stop = (position: number, countryCode: string | null) => ({ position, countryCode })

describe('phrase card languages', () => {
  it('every country maps to a language the API supports', () => {
    for (const code of ['TH', 'JP', 'BR', 'TW', 'KH', 'MX', 'US']) {
      expect(PHRASE_CARD_LANGUAGES).toContain(languageForCountry(code))
    }
  })

  it('Thailand preselects Thai', () => {
    expect(languageForCountry('TH')).toBe('th')
    expect(languageForCountry('th')).toBe('th')
  })

  it('an unknown or missing country has no language', () => {
    expect(languageForCountry('ZZ')).toBeNull()
    expect(languageForCountry(null)).toBeNull()
  })

  it('the destination is the first stop in trip order with a language other than the traveller’s', () => {
    expect(destinationLanguage([stop(2, 'JP'), stop(1, 'TH')], 'en')).toBe('th')
    expect(destinationLanguage([stop(1, 'ES'), stop(2, 'TH')], 'es')).toBe('th')
  })

  it('falls back to the traveller’s own language when every stop speaks it, and to null without a country', () => {
    expect(destinationLanguage([stop(1, 'MX')], 'es')).toBe('es')
    expect(destinationLanguage([stop(1, null)], 'en')).toBeNull()
    expect(destinationLanguage([], 'en')).toBeNull()
  })
})
