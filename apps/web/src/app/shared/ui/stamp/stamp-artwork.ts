import stamps from '../../../../../public/stamps/stamps.json'

/** `public/stamps/stamps.json`: the places that have drawn artwork. */
export interface StampArtwork {
  /** ISO 3166-1 alpha-2 country code, optionally `-<city>`. */
  code: string
  file: string
  /** The place's name, for places Intl does not know (the synthetic sample countries). */
  name?: string
}

const ARTWORK: ReadonlyMap<string, StampArtwork> = new Map(
  (stamps as { stamps: StampArtwork[] }).stamps.map((stamp) => [stamp.code, stamp])
)

/** The artwork file served for a place, relative to the base href; undefined means the generated fallback. */
export function stampArtworkUrl(code: string): string | undefined {
  const artwork = ARTWORK.get(code)
  return artwork ? `stamps/${artwork.file}` : undefined
}

/** The name `stamps.json` gives a place, if any. */
export function stampArtworkName(code: string): string | undefined {
  return ARTWORK.get(code)?.name
}

/** A stable tilt per place between −8° and +8°, so a stamp never jumps between renders. */
export function stampRotation(code: string): number {
  let hash = 0
  for (const char of code) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return (hash % 17) - 8
}
