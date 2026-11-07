import { ApiFailure, apiCall, toApiFailure } from './api-failure'

function httpError(status: number, response: unknown, headers: Record<string, string> = {}) {
  return {
    kind: 'http' as const,
    status,
    response,
    rawResponse: { headers: { get: (name: string) => headers[name] ?? null } },
    message: `Request failed with status code ${status}`,
  }
}

describe('toApiFailure', () => {
  it('maps a { message, code } body to the code and keeps the extra fields', () => {
    const failure = toApiFailure(
      httpError(409, {
        message: 'You still own trips other people use',
        code: 'E_SOLE_OWNER_OF_SHARED_TRIPS',
        tripIds: ['t1', 't2'],
      })
    )

    expect(failure.kind).toBe('http')
    expect(failure.status).toBe(409)
    expect(failure.code).toBe('E_SOLE_OWNER_OF_SHARED_TRIPS')
    expect(failure.message).toBe('You still own trips other people use')
    expect(failure.details).toEqual({ tripIds: ['t1', 't2'] })
    expect(failure.is('E_SOLE_OWNER_OF_SHARED_TRIPS')).toBe(true)
  })

  it('maps a 422 { errors } body to typed field errors', () => {
    const failure = toApiFailure(
      httpError(422, {
        errors: [
          { field: 'email', rule: 'email', message: 'Enter a valid e-mail' },
          { field: 'password', rule: 'minLength', message: 'Too short' },
        ],
      })
    )

    expect(failure.code).toBe('E_VALIDATION_ERROR')
    expect(failure.fields).toHaveLength(2)
    expect(failure.fieldMessage('password')).toBe('Too short')
    expect(failure.message).toBe('Enter a valid e-mail')
  })

  it('reads Retry-After on a 429', () => {
    const failure = toApiFailure(
      httpError(
        429,
        { message: 'Too many attempts', code: 'E_TOO_MANY_REQUESTS' },
        {
          'Retry-After': '120',
        }
      )
    )

    expect(failure.isStatus(429)).toBe(true)
    expect(failure.retryAfterSeconds).toBe(120)
  })

  it('a 429 without a JSON body still carries the throttle code', () => {
    const failure = toApiFailure(httpError(429, 'Too Many Requests', { 'Retry-After': '5' }))

    expect(failure.code).toBe('E_TOO_MANY_REQUESTS')
    expect(failure.retryAfterSeconds).toBe(5)
  })

  it('a network error has no status and no code', () => {
    const failure = toApiFailure({ kind: 'network', message: 'Network error: GET /api/v1/auth/me' })

    expect(failure.kind).toBe('network')
    expect(failure.status).toBeNull()
    expect(failure.code).toBeNull()
  })

  it('anything else thrown before an answer counts as a network failure', () => {
    const failure = toApiFailure(new TypeError('fetch failed'))

    expect(failure.kind).toBe('network')
    expect(failure.message).toBe('fetch failed')
  })

  it('an ApiFailure passes through unchanged', () => {
    const original = new ApiFailure({
      kind: 'http',
      status: 401,
      code: 'E_UNAUTHORIZED',
      message: 'x',
    })

    expect(toApiFailure(original)).toBe(original)
  })
})

describe('apiCall', () => {
  it('returns the answer of a request that succeeds', async () => {
    expect(await apiCall(async () => 42)).toBe(42)
  })

  it('rethrows a failing request as an ApiFailure', async () => {
    const call = apiCall(async () => {
      throw httpError(401, { message: 'Sign in first', code: 'E_UNAUTHORIZED' })
    })

    await expect(call).rejects.toBeInstanceOf(ApiFailure)
    await expect(call).rejects.toMatchObject({ status: 401, code: 'E_UNAUTHORIZED' })
  })
})
