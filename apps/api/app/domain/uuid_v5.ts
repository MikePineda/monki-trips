import { createHash } from 'node:crypto'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * RFC 9562 name-based UUID (version 5, SHA-1): the same namespace and name
 * always give the same id. An import derives every row id and mutation id
 * from one fresh UUID per import and the row's `ref`, so the ids are unique
 * per import yet reproducible within it.
 */
export function uuidV5(namespace: string, name: string): string {
  if (!UUID.test(namespace)) throw new RangeError('uuidV5: the namespace must be a UUID')
  const hash = createHash('sha1')
    .update(Buffer.from(namespace.replace(/-/g, ''), 'hex'))
    .update(name, 'utf8')
    .digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}
