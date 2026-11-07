import { tripRole } from './trip-role'

describe('tripRole', () => {
  const members = [
    { userId: 'u1', role: 'owner' as const },
    { userId: 'u2', role: 'editor' as const },
  ]

  it('reads the role from the members table first', () => {
    expect(tripRole(members, 'u1', 'editor')).toBe('owner')
    expect(tripRole(members, 'u2', 'owner')).toBe('editor')
  })

  it('falls back to the role the trip list gave before the first pull', () => {
    expect(tripRole([], 'u1', 'owner')).toBe('owner')
  })

  it('editor cannot edit owner-only fields: unknown means editor', () => {
    expect(tripRole([], 'u1', undefined)).toBe('editor')
    expect(tripRole(members, null, undefined)).toBe('editor')
  })
})
