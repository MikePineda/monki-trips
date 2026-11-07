/**
 * The file name of a trip export: `trip-<slug>-<date>.json`, ASCII only so
 * it fits a plain `filename=` (the trip name is for people, the slug for
 * file systems).
 */
export function tripExportFileName(tripName: string, exportedAt: Date): string {
  const slug =
    tripName
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '') || 'trip'
  return `trip-${slug}-${exportedAt.toISOString().slice(0, 10)}.json`
}
