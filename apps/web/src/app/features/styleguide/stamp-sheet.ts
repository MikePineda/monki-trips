import type { StampArrival } from '../../shared/ui/stamp/stamp-generator'

export interface StampSheetEntry {
  code: string
  name: string
  date: string
  arrivedBy: StampArrival | null
}

/**
 * Twelve invented places for the sheet of generated stamps (the owner's
 * review of the generator). None of them has drawn artwork, so every one
 * is drawn by the generator.
 */
export const STAMP_SHEET: readonly StampSheetEntry[] = [
  { code: 'XC', name: 'Harbour City', date: '2026-05-02', arrivedBy: 'plane' },
  { code: 'XC', name: 'Old Town', date: '2026-05-05', arrivedBy: 'train' },
  { code: 'XD', name: 'Hill Fort', date: '2026-05-09', arrivedBy: 'road' },
  { code: 'XD', name: 'Snow Peak', date: '2026-06-14', arrivedBy: null },
  { code: 'XE', name: 'Lantern Bay', date: '2026-07-01', arrivedBy: 'boat' },
  { code: 'XE', name: 'Copper Ridge', date: '2026-07-04', arrivedBy: 'train' },
  { code: 'XF', name: 'Mistral Point', date: '2026-08-20', arrivedBy: 'plane' },
  { code: 'XF', name: 'Saltmarsh', date: '2026-08-23', arrivedBy: 'boat' },
  { code: 'XG', name: 'Juniper Falls', date: '2026-09-11', arrivedBy: 'road' },
  { code: 'XG', name: 'Velvet Dunes', date: '2026-09-15', arrivedBy: 'plane' },
  { code: 'XH', name: 'Quillon Isle', date: '2026-10-03', arrivedBy: 'boat' },
  { code: 'XH', name: 'The Long Lagoon Of Seven Bridges', date: '2026-10-06', arrivedBy: 'train' },
]
