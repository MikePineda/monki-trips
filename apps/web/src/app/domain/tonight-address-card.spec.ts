import type { PhraseCard } from '@monkitrips/shared'
import { tonightAddressCard } from './tonight-address-card'

const lodging = (phrase: string): PhraseCard => ({
  category: 'lodging_address',
  prompt: 'Please take me to this address',
  phrase,
  romanization: null,
  note: null,
})
const hello: PhraseCard = {
  category: 'greetings',
  prompt: 'Hello',
  phrase: 'สวัสดี',
  romanization: null,
  note: null,
}

const tonight = {
  title: 'Demo Riverside Inn',
  placeName: 'Demo Riverside Inn',
  address: '9 Example Road, Demo Town',
  addressLocal: '9 ถนนตัวอย่าง',
}

describe('tonightAddressCard', () => {
  it('picks the address card that quotes tonight’s local address', () => {
    const sets = [
      {
        id: 'th-set',
        language: 'th',
        cards: [hello, lodging('ไปที่ 1 ถนนอื่น'), lodging('ไปที่ 9  ถนนตัวอย่าง ค่ะ')],
      },
    ]

    expect(tonightAddressCard(sets, tonight, 'th')).toBe('th-set:2')
  })

  it('takes the only address card of a set when none quotes the stay', () => {
    const sets = [{ id: 'th-set', language: 'th', cards: [hello, lodging('ไปที่โรงแรม')] }]

    expect(tonightAddressCard(sets, tonight, 'th')).toBe('th-set:1')
  })

  it('prefers the set in the language of the day’s country', () => {
    const sets = [
      { id: 'ja-set', language: 'ja', cards: [lodging('ホテルへ')] },
      { id: 'th-set', language: 'th', cards: [lodging('ไปที่โรงแรม')] },
    ]

    expect(tonightAddressCard(sets, tonight, 'th')).toBe('th-set:0')
  })

  it('answers null without cards, or with several address cards and none quoted', () => {
    expect(tonightAddressCard([], tonight, 'th')).toBeNull()
    const sets = [{ id: 'th-set', language: 'th', cards: [lodging('ที่หนึ่ง'), lodging('ที่สอง')] }]
    expect(tonightAddressCard(sets, tonight, 'th')).toBeNull()
  })
})
