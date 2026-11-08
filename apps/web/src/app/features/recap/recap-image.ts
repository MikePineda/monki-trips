import { DOCUMENT, InjectionToken, inject } from '@angular/core'
import type { RecapCard } from '../../domain/recap-card'
import { ACTIVE_MASCOT, mascotSheetUrl } from '../../shared/ui/mascot/mascot-sheet'

/** How the image reached the person. */
export type RecapImageOutcome = 'shared' | 'downloaded' | 'cancelled'

/** Turns the recap card into a PNG on the device and hands it over. */
export interface RecapImageSharer {
  share(card: RecapCard, fileName: string): Promise<RecapImageOutcome>
}

/**
 * The recap image, drawn on a canvas on the device: no network, no
 * library, the self-hosted fonts the page already uses, colours read from
 * the theme tokens at runtime. The system share sheet takes the PNG when
 * the browser can share files; otherwise it downloads.
 */
export const RECAP_IMAGE = new InjectionToken<RecapImageSharer>('RECAP_IMAGE', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT)
    return { share: (card, fileName) => shareCanvasImage(document, card, fileName) }
  },
})

const WIDTH = 1080
const HEIGHT = 1350
const PAD = 88
const KIKO = 220

interface Palette {
  surface: string
  surfaceSunken: string
  ink: string
  ink2: string
  ink3: string
  line: string
  stamp: string
  sans: string
  mono: string
}

function palette(document: Document): Palette {
  const style = document.defaultView?.getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string) => style?.getPropertyValue(name).trim() || fallback
  return {
    surface: token('--surface-1', 'white'),
    surfaceSunken: token('--surface-2', 'whitesmoke'),
    ink: token('--ink-1', 'black'),
    ink2: token('--ink-2', 'dimgray'),
    ink3: token('--ink-3', 'gray'),
    line: token('--line', 'lightgray'),
    stamp: token('--stamp-ink', 'steelblue'),
    sans: token('--font-sans', 'sans-serif'),
    mono: token('--font-mono', 'monospace'),
  }
}

/** Splits `text` into lines no wider than `width`, at most `max` (the last one ellipsed). */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= width || !line) {
      line = next
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length > max) {
    const kept = lines.slice(0, max)
    let last = `${kept[max - 1]}…`
    while (ctx.measureText(last).width > width && last.length > 1) {
      last = `${last.slice(0, -2)}…`
    }
    kept[max - 1] = last
    return kept
  }
  return lines
}

async function kikoFrame(
  document: Document,
  state: RecapCard['mascot']
): Promise<{ image: HTMLImageElement; sx: number; sy: number; w: number; h: number } | null> {
  const sheet = ACTIVE_MASCOT
  const frames = sheet.states[state]
  const [col, row] = frames.frames[frames.still] ?? [0, 0]
  const image = document.createElement('img')
  image.src = new URL(mascotSheetUrl(sheet), document.baseURI).href
  try {
    await image.decode()
  } catch {
    return null
  }
  return {
    image,
    sx: col * sheet.frame.w,
    sy: row * sheet.frame.h,
    w: sheet.frame.w,
    h: sheet.frame.h,
  }
}

/** Draws the card; exported for the styleguide and the specs of the painter alone. */
export async function paintRecapCard(
  document: Document,
  canvas: HTMLCanvasElement,
  card: RecapCard
): Promise<void> {
  const colours = palette(document)
  await Promise.allSettled([
    document.fonts?.load(`600 72px ${colours.sans}`),
    document.fonts?.load(`400 32px ${colours.sans}`),
    document.fonts?.load(`500 36px ${colours.mono}`),
  ])
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D is not available')
  }
  ctx.fillStyle = colours.surface
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.textBaseline = 'alphabetic'

  const kiko = await kikoFrame(document, card.mascot)
  if (kiko) {
    ctx.drawImage(kiko.image, kiko.sx, kiko.sy, kiko.w, kiko.h, WIDTH - PAD - KIKO, PAD, KIKO, KIKO)
  }

  const textWidth = WIDTH - PAD * 2 - (kiko ? KIKO + 24 : 0)
  let y = PAD + 40
  ctx.fillStyle = colours.ink
  ctx.font = `600 76px ${colours.sans}`
  for (const line of wrap(ctx, card.title, textWidth, 2)) {
    y += 76
    ctx.fillText(line, PAD, y)
  }
  ctx.fillStyle = colours.ink2
  ctx.font = `400 34px ${colours.sans}`
  y += 56
  ctx.fillText(wrap(ctx, card.dates, textWidth, 1)[0] ?? '', PAD, y)

  // The perforation of a boarding pass: a hairline with a notch at both ends.
  y = Math.max(y + 64, PAD + KIKO + 48)
  ctx.strokeStyle = colours.line
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(WIDTH - PAD, y)
  ctx.stroke()
  ctx.fillStyle = colours.surfaceSunken
  for (const x of [0, WIDTH]) {
    ctx.beginPath()
    ctx.arc(x, y, 28, 0, Math.PI * 2)
    ctx.fill()
  }

  if (card.route) {
    ctx.fillStyle = colours.ink
    ctx.font = `500 38px ${colours.mono}`
    for (const line of wrap(ctx, card.route, WIDTH - PAD * 2, 3)) {
      y += 60
      ctx.fillText(line, PAD, y)
    }
  }

  y += 72
  const columnWidth = (WIDTH - PAD * 2) / 2
  card.rows.forEach((row, index) => {
    const x = PAD + (index % 2) * columnWidth
    const top = y + Math.floor(index / 2) * 170
    ctx.fillStyle = colours.ink2
    ctx.font = `400 30px ${colours.sans}`
    ctx.fillText(wrap(ctx, row.label, columnWidth - 24, 1)[0] ?? '', x, top + 30)
    ctx.fillStyle = colours.ink
    ctx.font = `600 64px ${colours.sans}`
    ctx.fillText(wrap(ctx, row.value, columnWidth - 24, 1)[0] ?? '', x, top + 104)
  })

  ctx.fillStyle = colours.stamp
  ctx.font = `500 30px ${colours.mono}`
  ctx.fillText(card.footer.toUpperCase(), PAD, HEIGHT - PAD)
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image'))),
      'image/png'
    )
  )
}

async function shareCanvasImage(
  document: Document,
  card: RecapCard,
  fileName: string
): Promise<RecapImageOutcome> {
  const canvas = document.createElement('canvas')
  await paintRecapCard(document, canvas, card)
  const file = new File([await canvasBlob(canvas)], fileName, { type: 'image/png' })
  const nav = document.defaultView?.navigator
  if (nav?.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: card.title })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled'
      }
      throw error
    }
  }
  const href = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = file.name
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(href), 0)
  return 'downloaded'
}
