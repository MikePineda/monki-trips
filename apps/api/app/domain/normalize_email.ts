/**
 * The canonical form of an e-mail address: trimmed and lowercase. The
 * database CHECK (`email = lower(email)`) rejects anything else, so every
 * path that stores or compares an address goes through here.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}
