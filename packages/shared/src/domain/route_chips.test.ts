import { test } from 'node:test'
import assert from 'node:assert/strict'
import { routeChips } from './route_chips.ts'

test('consecutive stops in same city collapse', () => {
  const chips = routeChips([
    { id: 's1', position: 1, name: 'Harbour City', countryCode: 'XA' },
    { id: 's2', position: 2, name: 'harbour city ', countryCode: 'XA' },
    { id: 's3', position: 3, name: 'Old Town', countryCode: 'XB' },
  ])
  assert.deepEqual(chips, [
    { label: 'Harbour City', countryCode: 'XA', stopIds: ['s1', 's2'] },
    { label: 'Old Town', countryCode: 'XB', stopIds: ['s3'] },
  ])
})

test('a city visited twice with another in between shows twice', () => {
  const chips = routeChips([
    { id: 's3', position: 3, name: 'Harbour City', countryCode: 'XA' },
    { id: 's1', position: 1, name: 'Harbour City', countryCode: 'XA' },
    { id: 's2', position: 2, name: 'Old Town', countryCode: 'XB' },
  ])
  assert.deepEqual(
    chips.map((c) => c.label),
    ['Harbour City', 'Old Town', 'Harbour City']
  )
})

test('no stops means no chips', () => {
  assert.deepEqual(routeChips([]), [])
})
