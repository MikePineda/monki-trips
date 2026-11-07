import type { EmergencyInfoContent } from '@monkitrips/shared'
import { changedKeys, hasContent, toContent, toFormModel } from './emergency-form'

const DEFAULTS = {
  hospital: 'Nearest hospital',
  localEmergency: 'Local emergency number',
  other: 'Contact',
}

const STORED: EmergencyInfoContent = {
  contacts: [{ name: 'Demo clinic', phone: '+1 555 0100', note: null }],
  insurance: { provider: 'Demo Assure', policyNumber: 'DEMO-1', phone: '+1 555 0101' },
  notes: 'Keep calm',
}

describe('emergency form mapping', () => {
  it('fills the form from the stored content and round-trips it', () => {
    const model = toFormModel(STORED)

    expect(model.insurer).toBe('Demo Assure')
    expect(model.hospital).toEqual({ name: 'Demo clinic', phone: '+1 555 0100' })
    expect(model.embassyName).toBe('')
    expect(toContent(model, DEFAULTS)).toEqual({
      contacts: STORED.contacts,
      insurance: STORED.insurance,
      notes: 'Keep calm',
    })
  })

  it('a number without a name takes the slot default; a slot without a number is left out', () => {
    const model = toFormModel({})
    model.localEmergency.phone = '112'
    model.hospital.name = 'Typed but no number'

    expect(toContent(model, DEFAULTS).contacts).toEqual([
      { name: 'Local emergency number', phone: '112', note: null },
    ])
  })

  it('emergency fields merge per key: only the keys that changed travel', () => {
    const model = toFormModel(STORED)
    model.embassyName = 'Consulate of Demo'
    model.notes = 'Keep calm'

    expect(changedKeys(STORED, toContent(model, DEFAULTS))).toEqual(['embassy'])
  })

  it('a key the trip never had stays untouched while it is still empty', () => {
    expect(changedKeys({}, toContent(toFormModel({}), DEFAULTS))).toEqual([])
    expect(hasContent({})).toBe(false)
    expect(hasContent({ contacts: [] })).toBe(false)
    expect(hasContent(STORED)).toBe(true)
  })
})
