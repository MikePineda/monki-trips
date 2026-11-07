/**
 * A `tel:` link for a phone number as people write it ("+1 555 0100",
 * "(02) 1234-5678"): digits only, a leading plus kept, everything else
 * dropped. Null when nothing dialable is left. Pure.
 */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) {
    return null
  }
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 0) {
    return null
  }
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`
}
