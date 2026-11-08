import { RECEIPT_MAX_IMAGE_SIDE_PX } from '@monkitrips/shared'

/** JPEG quality of the re-encoded receipt: legible print, a few hundred KB. */
export const RECEIPT_JPEG_QUALITY = 0.85

export interface ImageSize {
  width: number
  height: number
}

/**
 * The size a receipt photo is drawn at: the longest side at most
 * `maxSide` px, the aspect ratio kept, never scaled up. Pure.
 */
export function receiptTargetSize(
  source: ImageSize,
  maxSide: number = RECEIPT_MAX_IMAGE_SIDE_PX
): ImageSize {
  const longest = Math.max(source.width, source.height)
  if (longest <= maxSide) {
    return { width: source.width, height: source.height }
  }
  const scale = maxSide / longest
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  }
}

/** A decoded photo: its pixels, already turned upright, and its size. */
export interface DecodedImage extends ImageSize {
  source: CanvasImageSource
  close?(): void
}

/** The part of a canvas the downscale uses (an HTMLCanvasElement fits). */
export interface ReceiptCanvas {
  width: number
  height: number
  getContext(kind: '2d'): Pick<CanvasRenderingContext2D, 'drawImage'> | null
  toBlob(callback: (blob: Blob | null) => void, type: string, quality: number): void
}

export interface ReceiptImageDeps {
  decode(file: Blob): Promise<DecodedImage>
  canvas(): ReceiptCanvas
}

/**
 * The photo that is sent for reading: decoded, drawn onto a canvas at
 * `receiptTargetSize` and re-encoded as JPEG. Only pixels survive the
 * canvas, so EXIF (the place a photo was taken, the device) is dropped
 * by construction; the orientation is applied while decoding.
 */
export async function downscaleReceipt(file: Blob, deps: ReceiptImageDeps): Promise<Blob> {
  const image = await deps.decode(file)
  try {
    const size = receiptTargetSize(image)
    const canvas = deps.canvas()
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('No 2d canvas')
    }
    context.drawImage(image.source, 0, 0, size.width, size.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('The canvas gave no image'))),
        'image/jpeg',
        RECEIPT_JPEG_QUALITY
      )
    )
  } finally {
    image.close?.()
  }
}

/** The browser's decoder and canvas: `createImageBitmap` with the EXIF orientation applied. */
export function browserReceiptImageDeps(document: Document): ReceiptImageDeps {
  return {
    decode: async (file) => {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      }
    },
    canvas: () => document.createElement('canvas'),
  }
}
