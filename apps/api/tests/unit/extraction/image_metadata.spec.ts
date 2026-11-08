import { test } from '@japa/runner'
import { crc32 } from 'node:zlib'
import { stripImageMetadata } from '#services/assistant/extraction/image_metadata'

const GPS = Buffer.from('GPSLatitude 12.3456 synthetic-location-marker')

function segment(marker: number, payload: Buffer): Buffer {
  const length = Buffer.alloc(2)
  length.writeUInt16BE(payload.length + 2)
  return Buffer.concat([Buffer.from([0xff, marker]), length, payload])
}

function jpeg(): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from('JFIF\0\x01\x02')),
    segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), GPS])),
    segment(0xdb, Buffer.alloc(65, 1)),
    Buffer.from([0xff, 0xda, 0x00, 0x04, 0x01, 0x02]),
    Buffer.from([0x11, 0x22, 0x33, 0xff, 0xd9]),
  ])
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function png(): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', Buffer.alloc(13, 1)),
    chunk('eXIf', GPS),
    chunk('tEXt', Buffer.concat([Buffer.from('Comment\0'), GPS])),
    chunk('IDAT', Buffer.alloc(20, 2)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function riffChunk(fourcc: string, data: Buffer): Buffer {
  const size = Buffer.alloc(4)
  size.writeUInt32LE(data.length)
  const pad = data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)
  return Buffer.concat([Buffer.from(fourcc, 'latin1'), size, data, pad])
}

function webp(): Buffer {
  const vp8x = Buffer.alloc(10)
  vp8x[0] = 0x08 | 0x04
  const body = Buffer.concat([
    Buffer.from('WEBP'),
    riffChunk('VP8X', vp8x),
    riffChunk('VP8 ', Buffer.alloc(30, 3)),
    riffChunk('EXIF', GPS),
    riffChunk('XMP ', GPS),
  ])
  const size = Buffer.alloc(4)
  size.writeUInt32LE(body.length)
  return Buffer.concat([Buffer.from('RIFF'), size, body])
}

test.group('Image metadata', () => {
  test('a photo reaches the model without its location data', ({ assert }) => {
    for (const [mime, bytes] of [
      ['image/jpeg', jpeg()],
      ['image/png', png()],
      ['image/webp', webp()],
    ] as const) {
      const stripped = stripImageMetadata(bytes, mime)!
      assert.equal(stripped.indexOf('synthetic-location-marker'), -1, mime)
      assert.isBelow(stripped.length, bytes.length, mime)
    }
  })

  test('the image data itself is kept', ({ assert }) => {
    const stripped = stripImageMetadata(jpeg(), 'image/jpeg')!
    assert.deepEqual([...stripped.subarray(0, 2)], [0xff, 0xd8])
    assert.isAbove(stripped.indexOf(Buffer.from([0x11, 0x22, 0x33, 0xff, 0xd9])), 0)
    assert.isAbove(stripImageMetadata(png(), 'image/png')!.indexOf('IDAT'), 0)
    const webpOut = stripImageMetadata(webp(), 'image/webp')!
    assert.equal(webpOut.readUInt32LE(4), webpOut.length - 8)
    assert.equal(webpOut[20] & 0x0c, 0, 'the vp8x flags no longer announce exif or xmp')
  })

  test('a photo whose structure cannot be walked is refused rather than sent as is', ({
    assert,
  }) => {
    assert.isNull(
      stripImageMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]), 'image/jpeg')
    )
  })
})
