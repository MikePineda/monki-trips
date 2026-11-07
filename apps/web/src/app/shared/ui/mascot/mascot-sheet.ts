import active from '../../../../../public/mascot/active.json'
import kiko from '../../../../../public/mascot/kiko/sheet.json'

/** The six states every mascot ships (docs/PLAN.md, mascot asset contract). */
export const MASCOT_STATES = [
  'happy',
  'worried',
  'excited',
  'asleep',
  'celebrating',
  'thinking',
] as const

export type MascotState = (typeof MASCOT_STATES)[number]

export interface MascotStateSheet {
  /** `[col, row]` of each frame on the sheet. */
  frames: [number, number][]
  /** 1 to 12. */
  fps: number
  loop: boolean
  /** Index into `frames` shown under reduced motion. */
  still: number
}

/** `public/mascot/<id>/sheet.json`. */
export interface MascotSheet {
  version: 1
  id: string
  frame: { w: number; h: number }
  render: 'smooth' | 'pixelated'
  /** File name of the sheet image next to the json. */
  sheet: string
  states: Record<MascotState, MascotStateSheet>
}

const SHEETS: Record<string, MascotSheet> = {
  kiko: kiko as MascotSheet,
}

/** The sheet `public/mascot/active.json` points at; bundled, so it works offline and in specs. */
export const ACTIVE_MASCOT: MascotSheet = SHEETS[active.id] ?? SHEETS['kiko']

/** Where the sheet image is served from, relative to the base href. */
export function mascotSheetUrl(sheet: MascotSheet): string {
  return `mascot/${sheet.id}/${sheet.sheet}`
}
