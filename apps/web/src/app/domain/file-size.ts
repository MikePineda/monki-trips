/**
 * A file size for a list row: kB up to a megabyte (whole numbers, never
 * "0 kB" for a real file), then MB and GB with one decimal, formatted by
 * `Intl` for the locale. Pure.
 */
const KB = 1024
const MB = KB * 1024
const GB = MB * 1024

export function formatFileSize(bytes: number | null | undefined, locale: string): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return ''
  }
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  if (bytes < MB) {
    return `${whole.format(Math.max(1, Math.round(bytes / KB)))} kB`
  }
  if (bytes < GB) {
    return `${decimal.format(bytes / MB)} MB`
  }
  return `${decimal.format(bytes / GB)} GB`
}
