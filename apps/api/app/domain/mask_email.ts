/**
 * An address as logs may show it: the first character of the local part
 * and the domain (`m***@example.com`). Enough to tell two mails apart while
 * debugging, not enough to recover who the person is.
 */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@')
  if (at < 0) return '***'
  return `${address.slice(0, Math.min(at, 1))}***${address.slice(at)}`
}
