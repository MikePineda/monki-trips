import { storagePressure } from './storage-warning'

describe('storagePressure', () => {
  const mb = (n: number) => n * 1024 * 1024

  it('is fine while the saved copies stay under half of the free quota', () => {
    expect(storagePressure({ usage: mb(100), quota: mb(1000) }, mb(50))).toEqual({
      warning: false,
      freeBytes: mb(900),
    })
  })

  it('storage warning above half the free quota', () => {
    expect(storagePressure({ usage: mb(100), quota: mb(1000) }, mb(451))).toEqual({
      warning: true,
      freeBytes: mb(900),
    })
  })

  it('a copy that would not fit warns too, and free space never goes negative', () => {
    expect(storagePressure({ usage: mb(1200), quota: mb(1000) }, mb(1))).toEqual({
      warning: true,
      freeBytes: 0,
    })
  })

  it('an unknown estimate warns about nothing', () => {
    expect(storagePressure(null, mb(5))).toEqual({ warning: false, freeBytes: null })
  })
})
