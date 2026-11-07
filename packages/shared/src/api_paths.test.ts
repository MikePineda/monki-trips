import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isApiPath } from './api_paths.ts'

test('the bare prefix and anything below it belong to the API', () => {
  assert.equal(isApiPath('/api'), true)
  assert.equal(isApiPath('/api/health'), true)
  assert.equal(isApiPath('/api/v1/trips'), true)
})

test('SPA routes and look-alike prefixes belong to the client', () => {
  assert.equal(isApiPath('/'), false)
  assert.equal(isApiPath('/trips'), false)
  assert.equal(isApiPath('/apiary'), false)
  assert.equal(isApiPath('/trips/api'), false)
})
