import { ApiFailure } from './api-failure'
import { failureMessage } from './failure-message'

const KNOWN = ['E_INVALID_CREDENTIALS', 'E_TOO_MANY_REQUESTS']

describe('failureMessage', () => {
  it('points at the code when the scope knows it', () => {
    const failure = new ApiFailure({
      kind: 'http',
      status: 401,
      code: 'E_INVALID_CREDENTIALS',
      message: 'server text',
    })

    expect(failureMessage(failure, 'auth', KNOWN)).toEqual({
      key: 'auth.errors.E_INVALID_CREDENTIALS',
      params: {},
      fallback: 'server text',
    })
  })

  it('a throttle says how many minutes to wait, rounded up', () => {
    const failure = new ApiFailure({
      kind: 'http',
      status: 429,
      code: 'E_TOO_MANY_REQUESTS',
      message: 'slow down',
      retryAfterSeconds: 61,
    })

    expect(failureMessage(failure, 'auth', KNOWN).params).toEqual({ minutes: 2 })
  })

  it('a throttle without Retry-After assumes the 15-minute window', () => {
    const failure = new ApiFailure({
      kind: 'http',
      status: 429,
      code: 'E_TOO_MANY_REQUESTS',
      message: 'slow down',
    })

    expect(failureMessage(failure, 'auth', KNOWN).params).toEqual({ minutes: 15 })
  })

  it('no answer is the network entry', () => {
    const failure = new ApiFailure({ kind: 'network', message: 'offline' })

    expect(failureMessage(failure, 'auth', KNOWN).key).toBe('auth.errors.network')
  })

  it('an unknown code falls back to the generic entry and keeps the server message', () => {
    const failure = new ApiFailure({ kind: 'http', status: 418, code: 'E_TEAPOT', message: 'brew' })

    expect(failureMessage(failure, 'auth', KNOWN)).toEqual({
      key: 'auth.errors.unknown',
      params: {},
      fallback: 'brew',
    })
  })

  it('a server error shows the translated generic entry, never the raw request text', () => {
    const failure = new ApiFailure({
      kind: 'http',
      status: 502,
      message: 'Request failed with status code 502 Bad Gateway: POST /api/v1/auth/login',
    })

    expect(failureMessage(failure, 'auth', KNOWN)).toEqual({
      key: 'auth.errors.unknown',
      params: {},
      fallback: '',
    })
  })

  it('a production 500 with its code shows the translated generic entry too', () => {
    const failure = new ApiFailure({
      kind: 'http',
      status: 500,
      code: 'E_INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    })

    expect(failureMessage(failure, 'auth', KNOWN).fallback).toBe('')
  })

  it('a client error without a code body shows the translated generic entry', () => {
    const failure = new ApiFailure({
      kind: 'http',
      status: 413,
      message: 'Request failed with status code 413 Payload Too Large: POST /api/v1/trips',
    })

    expect(failureMessage(failure, 'auth', KNOWN).fallback).toBe('')
  })
})
