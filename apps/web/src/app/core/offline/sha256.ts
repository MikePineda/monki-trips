/**
 * The SHA-256 of a blob or its bytes as lowercase hex, the way the API hashes an
 * upload, so a saved copy can be checked against the server's `sha256`.
 * Web Crypto only (available in every supported browser and in Node).
 */
export async function sha256Hex(data: Blob | ArrayBuffer): Promise<string> {
  const bytes = data instanceof Blob ? await data.arrayBuffer() : data
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
