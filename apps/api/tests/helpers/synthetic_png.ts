import { crc32 } from 'node:zlib'

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/**
 * A structurally valid PNG (signature, IHDR, IDAT, IEND) for tests that
 * send a photo. `marker` goes into a `tEXt` chunk, so a test can prove the
 * metadata never left the server.
 */
export function syntheticPng(marker?: string): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0)
  ihdr.writeUInt32BE(1, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...(marker ? [chunk('tEXt', Buffer.from(`Comment\0${marker}`, 'latin1'))] : []),
    chunk('IDAT', Buffer.from('789c63f8cfc0000003010100c95f1f3e', 'hex')),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
