import { formMessageKey, formMessageParams } from './form-messages'

describe('form messages', () => {
  it('a known error kind maps to its ui catalogue key', () => {
    expect(formMessageKey({ kind: 'required' })).toBe('ui.fieldErrors.required')
    expect(formMessageKey({ kind: 'minLength', minLength: 3 })).toBe('ui.fieldErrors.minLength')
  })

  it('an unknown kind falls back to the generic message', () => {
    expect(formMessageKey({ kind: 'iban' })).toBe('ui.fieldErrors.invalid')
  })

  it('the error details become interpolation parameters', () => {
    expect(formMessageParams({ kind: 'min', min: 1 })).toEqual({ min: 1 })
  })

  it('length errors expose min and max whatever the validator called them', () => {
    expect(formMessageParams({ kind: 'minLength', minLength: 3 })).toEqual({ minLength: 3, min: 3 })
    expect(formMessageParams({ kind: 'maxLength', maxLength: 8 })).toEqual({ maxLength: 8, max: 8 })
  })

  it('ignores non-scalar details and the message', () => {
    expect(formMessageParams({ kind: 'pattern', message: 'x', re: /a/, nested: {} })).toEqual({})
  })
})
