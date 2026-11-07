/**
 * Device facts the PWA layer needs, from strings the caller reads. Pure.
 */

/** iPhone, iPad and iPod, including iPadOS pretending to be a Mac with touch. */
export function isIosUserAgent(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return true
  }
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1
}
