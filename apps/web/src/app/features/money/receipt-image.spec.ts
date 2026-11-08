import {
  RECEIPT_JPEG_QUALITY,
  downscaleReceipt,
  receiptTargetSize,
  type ReceiptCanvas,
  type ReceiptImageDeps,
} from './receipt-image'

/** A tiny JPEG with an APP1/Exif segment carrying a synthetic GPS marker. */
const EXIF_JPEG = new Uint8Array([
  0xff,
  0xd8,
  0xff,
  0xe1,
  0x00,
  0x16,
  ...new TextEncoder().encode('Exif\0\0GPS-SYNTHETIC'),
  0xff,
  0xd9,
])

const CANVAS_BYTES = new TextEncoder().encode('canvas-pixels')

/** A canvas that records what is drawn and encodes to fixed bytes. */
class RecordingCanvas implements ReceiptCanvas {
  width = 0
  height = 0
  drawn: unknown[][] = []
  encodedAs: [string, number][] = []

  getContext() {
    return {
      drawImage: (...args: unknown[]) => {
        this.drawn.push(args)
      },
    } as unknown as Pick<CanvasRenderingContext2D, 'drawImage'>
  }

  toBlob(callback: (blob: Blob | null) => void, type: string, quality: number): void {
    this.encodedAs.push([type, quality])
    callback(new Blob([CANVAS_BYTES], { type }))
  }
}

function deps(width: number, height: number) {
  const canvas = new RecordingCanvas()
  const pixels = { kind: 'decoded-bitmap' }
  const decoded: Blob[] = []
  let closed = 0
  const value: ReceiptImageDeps = {
    decode: (file) => {
      decoded.push(file)
      return Promise.resolve({
        source: pixels as unknown as CanvasImageSource,
        width,
        height,
        close: () => (closed += 1),
      })
    },
    canvas: () => canvas,
  }
  return { value, canvas, pixels, decoded, closed: () => closed }
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

function contains(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return true
  }
  return false
}

describe('receipt image', () => {
  it('receipt downscale keeps the longest side at 1600 px', async () => {
    expect(receiptTargetSize({ width: 4000, height: 3000 })).toEqual({ width: 1600, height: 1200 })
    expect(receiptTargetSize({ width: 3024, height: 4032 })).toEqual({ width: 1200, height: 1600 })
    expect(receiptTargetSize({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 })
    expect(receiptTargetSize({ width: 1600, height: 20 })).toEqual({ width: 1600, height: 20 })

    const { value, canvas, pixels } = deps(4000, 3000)
    await downscaleReceipt(new Blob([EXIF_JPEG], { type: 'image/jpeg' }), value)

    expect([canvas.width, canvas.height]).toEqual([1600, 1200])
    expect(canvas.drawn).toEqual([[pixels, 0, 0, 1600, 1200]])
  })

  it('receipt downscale re-encodes through a canvas so no exif survives', async () => {
    const original = new Blob([EXIF_JPEG], { type: 'image/jpeg' })
    const { value, canvas, pixels, decoded, closed } = deps(2000, 1000)

    const out = await downscaleReceipt(original, value)

    expect(out.type).toBe('image/jpeg')
    expect(canvas.encodedAs).toEqual([['image/jpeg', RECEIPT_JPEG_QUALITY]])
    // The file only reaches the decoder; the canvas draws the decoded pixels.
    expect(decoded).toEqual([original])
    expect(canvas.drawn[0][0]).toBe(pixels)
    const bytes = await bytesOf(out)
    expect(Array.from(bytes)).toEqual(Array.from(CANVAS_BYTES))
    expect(contains(bytes, new TextEncoder().encode('Exif'))).toBe(false)
    expect(contains(bytes, new TextEncoder().encode('GPS-SYNTHETIC'))).toBe(false)
    expect(closed()).toBe(1)
  })
})
