/**
 * Removes the metadata a photo carries (EXIF with its GPS position, XMP,
 * IPTC, text comments) before the file goes to the model provider, in
 * pure JavaScript and without decoding the image: only whole metadata
 * segments or chunks are dropped, the pixels are untouched. Pure: no I/O.
 *
 * - JPEG: APP1 (EXIF, XMP), APP13 (IPTC) and COM segments before the scan.
 * - PNG: `eXIf`, `tEXt`, `zTXt`, `iTXt` and `tIME` chunks.
 * - WebP: `EXIF` and `XMP ` chunks, with the VP8X flags and RIFF size fixed.
 * - GIF carries no EXIF and is returned as it is.
 *
 * A file whose structure cannot be walked answers null: the caller refuses
 * it rather than send bytes that might still hold a location.
 */
export function stripImageMetadata(bytes: Buffer, mime: string): Buffer | null {
  try {
    switch (mime) {
      case 'image/jpeg':
        return stripJpeg(bytes)
      case 'image/png':
        return stripPng(bytes)
      case 'image/webp':
        return stripWebp(bytes)
      case 'image/gif':
        return bytes
      default:
        return null
    }
  } catch {
    return null
  }
}

const JPEG_DROPPED = new Set([0xe1, 0xed, 0xfe])

function stripJpeg(bytes: Buffer): Buffer | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  const kept: Buffer[] = [bytes.subarray(0, 2)]
  let offset = 2
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    const marker = bytes[offset + 1]
    if (marker === undefined) return null
    // Fill bytes and markers without a length.
    if (marker === 0xff) {
      offset += 1
      continue
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(bytes.subarray(offset, offset + 2))
      offset += 2
      continue
    }
    if (marker === 0xd9) {
      kept.push(bytes.subarray(offset))
      break
    }
    if (offset + 4 > bytes.length) return null
    const length = bytes.readUInt16BE(offset + 2)
    if (length < 2 || offset + 2 + length > bytes.length) return null
    // Start of scan: the entropy-coded data and everything after it stay as they are.
    if (marker === 0xda) {
      kept.push(bytes.subarray(offset))
      break
    }
    if (!JPEG_DROPPED.has(marker)) kept.push(bytes.subarray(offset, offset + 2 + length))
    offset += 2 + length
  }
  return Buffer.concat(kept)
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PNG_DROPPED = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'])

function stripPng(bytes: Buffer): Buffer | null {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null
  const kept: Buffer[] = [bytes.subarray(0, 8)]
  let offset = 8
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) return null
    const length = bytes.readUInt32BE(offset)
    const end = offset + 12 + length
    if (end > bytes.length) return null
    const type = bytes.toString('latin1', offset + 4, offset + 8)
    if (!PNG_DROPPED.has(type)) kept.push(bytes.subarray(offset, end))
    offset = end
    if (type === 'IEND') break
  }
  return Buffer.concat(kept)
}

const WEBP_DROPPED = new Set(['EXIF', 'XMP '])
/** VP8X flag bits that announce an EXIF or an XMP chunk. */
const VP8X_METADATA_FLAGS = 0x08 | 0x04

function stripWebp(bytes: Buffer): Buffer | null {
  if (bytes.toString('latin1', 0, 4) !== 'RIFF' || bytes.toString('latin1', 8, 12) !== 'WEBP') {
    return null
  }
  const kept: Buffer[] = []
  let offset = 12
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) return null
    const fourcc = bytes.toString('latin1', offset, offset + 4)
    const size = bytes.readUInt32LE(offset + 4)
    const end = offset + 8 + size + (size % 2)
    if (end > bytes.length) return null
    if (!WEBP_DROPPED.has(fourcc)) {
      const piece = Buffer.from(bytes.subarray(offset, end))
      if (fourcc === 'VP8X' && size > 0) piece[8] &= ~VP8X_METADATA_FLAGS
      kept.push(piece)
    }
    offset = end
  }
  const body = Buffer.concat([Buffer.from('WEBP'), ...kept])
  const header = Buffer.alloc(8)
  header.write('RIFF', 0, 'latin1')
  header.writeUInt32LE(body.length, 4)
  return Buffer.concat([header, body])
}
