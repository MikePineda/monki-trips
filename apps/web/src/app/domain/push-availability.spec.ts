import { applicationServerKey, pushAvailability } from './push-availability'

describe('pushAvailability', () => {
  const base = { supported: true, ios: false, standalone: false, permission: 'default' as const }

  it('is available in a capable browser with no decision yet', () => {
    expect(pushAvailability(base)).toBe('available')
    expect(pushAvailability({ ...base, permission: 'granted' })).toBe('available')
  })

  it('an iOS browser tab needs the installed app first, whatever the APIs say', () => {
    expect(pushAvailability({ ...base, ios: true })).toBe('ios-install')
    expect(pushAvailability({ ...base, ios: true, supported: false })).toBe('ios-install')
  })

  it('the installed iOS app counts as a capable browser', () => {
    expect(pushAvailability({ ...base, ios: true, standalone: true })).toBe('available')
    expect(pushAvailability({ ...base, ios: true, standalone: true, supported: false })).toBe(
      'unsupported'
    )
  })

  it('a refused permission is blocked, a missing API is unsupported', () => {
    expect(pushAvailability({ ...base, permission: 'denied' })).toBe('blocked')
    expect(pushAvailability({ ...base, supported: false })).toBe('unsupported')
  })
})

describe('applicationServerKey', () => {
  it('decodes a url-safe base64 vapid key into its 65 raw bytes', () => {
    const key =
      'BJT8n4mGFig1eRSRezUN_1iZzDuim2OD5KrJzqtXgR8MBLTmVl1OVY8vuhGeVv2MdAswfZtGdXtS-YSU117sKFg'

    const bytes = applicationServerKey(key)

    expect(bytes).toHaveLength(65)
    // An uncompressed P-256 point starts with 0x04.
    expect(bytes[0]).toBe(0x04)
  })
})
