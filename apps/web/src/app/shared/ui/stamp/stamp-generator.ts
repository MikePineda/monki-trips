/**
 * The passport stamp generator: a pure function from a place and a date to
 * the drawing of its stamp, so every place without hand-drawn artwork still
 * gets a stamp of its own, offline and the same on every render. The seed
 * is the trimmed, case-folded place name plus the date; from it come the
 * shape (circle, rounded rectangle, octagon, oval), the ink (one of the four
 * `--stamp-ink-*` tokens), a tilt of −8° to +8°, the inner line style, the
 * little stars and the ink texture. The place runs along the top arc of a
 * round stamp and straight across the others; the date sits in the middle
 * day first; the icon says how the travellers arrived. No colour literals:
 * the drawing is `currentColor`, painted by `mk-stamp` with `inkVar`.
 */

/** How the travellers reached the place (`ArrivalMode` in `@monkitrips/shared`). */
export type StampArrival = 'plane' | 'train' | 'boat' | 'road'

export const STAMP_SHAPES = ['circle', 'rounded', 'octagon', 'oval'] as const
export type StampShape = (typeof STAMP_SHAPES)[number]

export type StampIcon = StampArrival | 'star'
export type StampInk = 1 | 2 | 3 | 4

export interface StampInput {
  place: string
  /** `YYYY-MM-DD`: seeds the drawing and prints as `DD.MM.YYYY`. */
  date?: string | null
  /** Printed instead of the date when given (already formatted). */
  label?: string | null
  /** Short code printed at the bottom (ISO country code, …). */
  code?: string | null
  arrivedBy?: StampArrival | null
}

export interface StampDesign {
  seed: number
  shape: StampShape
  /** The drawing's box; everything below is in its units. */
  viewBox: string
  /** Outer line, 2.5 units. */
  outline: string
  /** Inner line, 1 unit; dotted on some stamps. */
  inner: string
  innerDotted: boolean
  /** Arc the place name follows on round stamps, else null (straight text). */
  textArc: string | null
  placeText: string
  /** Text length to squeeze a long name into, null when it fits. */
  placeFit: number | null
  placeY: number
  dateText: string
  dateY: number
  codeText: string
  codeY: number
  icon: StampIcon
  /** Translation of the 24-unit icon box. */
  iconX: number
  iconY: number
  /** Small stars on each side of the date. */
  stars: { x: number; y: number }[]
  ink: StampInk
  inkVar: string
  rotation: number
  texture: { seed: number; frequency: number }
}

const SIZE = 120
const CENTRE = SIZE / 2

/** FNV-1a over the normalised place and the date. */
export function stampSeed(place: string, date?: string | null): number {
  const text = `${place.trim().toLocaleLowerCase()}|${date ?? ''}`
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** mulberry32: a small deterministic stream of numbers in [0, 1). */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** `YYYY-MM-DD` → `DD.MM.YYYY`, the way a border stamp prints it. */
export function stampDateText(date: string): string {
  const [year, month, day] = date.split('-')
  return year && month && day ? `${day}.${month}.${year}` : date
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function circlePath(r: number): string {
  return `M${CENTRE - r} ${CENTRE}A${r} ${r} 0 1 1 ${CENTRE + r} ${CENTRE}A${r} ${r} 0 1 1 ${CENTRE - r} ${CENTRE}Z`
}

function ellipsePath(rx: number, ry: number): string {
  return `M${CENTRE - rx} ${CENTRE}A${rx} ${ry} 0 1 1 ${CENTRE + rx} ${CENTRE}A${rx} ${ry} 0 1 1 ${CENTRE - rx} ${CENTRE}Z`
}

function roundedPath(halfW: number, halfH: number, radius: number): string {
  const left = CENTRE - halfW
  const right = CENTRE + halfW
  const top = CENTRE - halfH
  const bottom = CENTRE + halfH
  return [
    `M${left + radius} ${top}`,
    `H${right - radius}`,
    `A${radius} ${radius} 0 0 1 ${right} ${top + radius}`,
    `V${bottom - radius}`,
    `A${radius} ${radius} 0 0 1 ${right - radius} ${bottom}`,
    `H${left + radius}`,
    `A${radius} ${radius} 0 0 1 ${left} ${bottom - radius}`,
    `V${top + radius}`,
    `A${radius} ${radius} 0 0 1 ${left + radius} ${top}`,
    'Z',
  ].join('')
}

function octagonPath(r: number): string {
  const points = Array.from({ length: 8 }, (_, index) => {
    const angle = Math.PI / 8 + (index * Math.PI) / 4
    return `${round(CENTRE + r * Math.cos(angle))} ${round(CENTRE + r * Math.sin(angle))}`
  })
  return `M${points.join('L')}Z`
}

/** An arc over the top, left to right, that `<textPath>` follows. */
function topArc(rx: number, ry: number): string {
  return `M${CENTRE - rx} ${CENTRE}A${rx} ${ry} 0 0 1 ${CENTRE + rx} ${CENTRE}`
}

interface ShapeLayout {
  outline: string
  inner: string
  textArc: string | null
  /** Room for the place: arc length or straight width, in units. */
  placeRoom: number
  placeY: number
  iconY: number
  dateY: number
  codeY: number
  starSpread: number
}

function layout(shape: StampShape): ShapeLayout {
  switch (shape) {
    case 'circle':
      return {
        outline: circlePath(56),
        inner: circlePath(49),
        textArc: topArc(40, 40),
        placeRoom: 104,
        placeY: 0,
        iconY: 40,
        dateY: 79,
        codeY: 95,
        starSpread: 41,
      }
    case 'oval':
      return {
        outline: ellipsePath(57, 44),
        inner: ellipsePath(50, 37),
        textArc: topArc(41, 28),
        placeRoom: 96,
        placeY: 0,
        iconY: 41,
        dateY: 78,
        codeY: 91,
        starSpread: 41,
      }
    case 'rounded':
      return {
        outline: roundedPath(56, 40, 10),
        inner: roundedPath(50, 34, 6),
        textArc: null,
        placeRoom: 88,
        placeY: 42,
        iconY: 46,
        dateY: 79,
        codeY: 89,
        starSpread: 41,
      }
    case 'octagon':
      return {
        outline: octagonPath(57),
        inner: octagonPath(50),
        textArc: null,
        placeRoom: 70,
        placeY: 42,
        iconY: 45,
        dateY: 82,
        codeY: 95,
        starSpread: 41,
      }
  }
}

/** Mono caps at 10 units: about 6.4 units per character with the letter spacing. */
const PLACE_ADVANCE = 6.4

export function stampDesign(input: StampInput): StampDesign {
  const seed = stampSeed(input.place, input.date ?? input.label)
  const next = random(seed)
  const shape = STAMP_SHAPES[Math.floor(next() * STAMP_SHAPES.length)]
  const ink = (1 + Math.floor(next() * 4)) as StampInk
  const rotation = Math.round(next() * 16) - 8
  const innerDotted = next() < 0.3
  const withStars = next() < 0.6
  const textureSeed = Math.floor(next() * 1000)
  const frequency = round(0.7 + next() * 0.5)
  const box = layout(shape)

  const placeText = input.place.trim().toLocaleUpperCase()
  const natural = placeText.length * PLACE_ADVANCE
  const dateText = input.label?.trim() || (input.date ? stampDateText(input.date) : '')

  return {
    seed,
    shape,
    viewBox: `0 0 ${SIZE} ${SIZE}`,
    outline: box.outline,
    inner: box.inner,
    innerDotted,
    textArc: box.textArc,
    placeText,
    placeFit: natural > box.placeRoom ? box.placeRoom : null,
    placeY: box.placeY,
    dateText,
    dateY: box.dateY,
    codeText: (input.code ?? '').trim().toLocaleUpperCase(),
    codeY: box.codeY,
    icon: input.arrivedBy ?? 'star',
    iconX: CENTRE - 12,
    iconY: box.iconY,
    stars: withStars
      ? [
          { x: CENTRE - box.starSpread, y: box.dateY - 4 },
          { x: CENTRE + box.starSpread, y: box.dateY - 4 },
        ]
      : [],
    ink,
    inkVar: `var(--stamp-ink-${ink})`,
    rotation,
    texture: { seed: textureSeed, frequency },
  }
}

/**
 * The icons, drawn for the stamps (original, 24-unit box), filled in
 * `currentColor` with the even-odd rule so windows and lane marks are holes.
 */
export const STAMP_ICON_PATHS: Record<StampIcon, string> = {
  plane:
    'M12 2c.9 0 1.5.9 1.5 2v5.2l8 4.6v2.1l-8-2.4v4.6l2.5 1.9V22L12 21l-4 1v-2l2.5-1.9v-4.6l-8 2.4v-2.1l8-4.6V4c0-1.1.6-2 1.5-2z',
  train:
    'M7 2h10a3 3 0 0 1 3 3v10a3 3 0 0 1-2.2 2.9L20 21h-2.4l-1.8-3H8.2l-1.8 3H4l2.2-3.1A3 3 0 0 1 4 15V5a3 3 0 0 1 3-3zm-.5 3.5v5h11v-5zM8 13.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm8 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z',
  boat: 'M11.5 2.5V13H5zM13 5v8h5.5zM2.5 15h19l-3.2 5.5H5.7z',
  road: 'M5 11l2-5h10l2 5h1a1 1 0 0 1 1 1v5h-2v2h-3v-2H8v2H5v-2H3v-5a1 1 0 0 1 1-1zm2.3-1h9.4l-1.2-3H8.5zM7 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z',
}
