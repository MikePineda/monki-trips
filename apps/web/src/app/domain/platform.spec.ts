import { isIosUserAgent } from './platform'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'

describe('isIosUserAgent', () => {
  it('recognises an iPhone', () => {
    expect(isIosUserAgent(IPHONE)).toBe(true)
  })

  it('recognises an iPad that claims to be a Mac by its touch points', () => {
    expect(isIosUserAgent(IPAD_AS_MAC, 5)).toBe(true)
    expect(isIosUserAgent(IPAD_AS_MAC, 0)).toBe(false)
  })

  it('is false for Android', () => {
    expect(isIosUserAgent(ANDROID)).toBe(false)
  })
})
