/**
 * The name of a country for a locale (`XB` → its name), from `Intl`; the
 * code itself when the runtime does not know it. `known` names win (the
 * artwork catalogue's synthetic countries). Pure.
 */
export function regionName(code: string, locale: string, known?: string): string {
  if (known) {
    return known
  }
  try {
    const name = new Intl.DisplayNames([locale], { type: 'region', fallback: 'code' }).of(code)
    return name ?? code
  } catch {
    return code
  }
}
