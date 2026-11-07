import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ERROR_CODES } from './error_codes.ts'

test('every error code is an E_ constant mapped to an HTTP error status', () => {
  for (const [code, status] of Object.entries(ERROR_CODES)) {
    assert.match(code, /^E_[A-Z_]+$/)
    assert.ok(status >= 400 && status < 600, `${code} -> ${status}`)
  }
})

test('the codes the plan names keep their status', () => {
  assert.equal(ERROR_CODES.E_REGISTRATION_CLOSED, 403)
  assert.equal(ERROR_CODES.E_EMAIL_NOT_VERIFIED, 403)
  assert.equal(ERROR_CODES.E_TRIP_ROLE, 403)
  assert.equal(ERROR_CODES.E_ROW_NOT_FOUND, 404)
  assert.equal(ERROR_CODES.E_INVITATION_EXPIRED, 410)
  assert.equal(ERROR_CODES.E_SOLE_OWNER_OF_SHARED_TRIPS, 409)
  assert.equal(ERROR_CODES.E_OWNER_CANNOT_LEAVE, 409)
  assert.equal(ERROR_CODES.E_BASE_CURRENCY_LOCKED, 409)
  assert.equal(ERROR_CODES.E_SYNC_CURSOR_EXPIRED, 410)
  assert.equal(ERROR_CODES.E_FILE_TOO_LARGE, 413)
  assert.equal(ERROR_CODES.E_UNSUPPORTED_FILE, 415)
  assert.equal(ERROR_CODES.E_FX_UNAVAILABLE, 503)
})
