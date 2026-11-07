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
})
