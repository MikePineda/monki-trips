/** Proxies whose client-address header the app may believe (`TRUSTED_PROXY`). */
export const TRUSTED_PROXIES = ['none', 'cloudflare'] as const

export type TrustedProxy = (typeof TRUSTED_PROXIES)[number]

export interface ClientAddressInput {
  /** The deployment's `TRUSTED_PROXY`. */
  trustedProxy: TrustedProxy
  /** What the HTTP layer resolved from the socket (and `trustProxy` for private hops). */
  socketIp: string
  /** The raw `CF-Connecting-IP` header, if any. */
  cfConnectingIp?: string | null
}

/**
 * The address throttles are keyed on. A client-address header is only as
 * trustworthy as the proxy that sets it: anyone can send `CF-Connecting-IP`,
 * so it counts only when the deployment says Cloudflare sits in front (and
 * the origin accepts no traffic from anywhere else). Otherwise the socket
 * address wins and rotating the header buys an attacker nothing.
 */
export function resolveClientIp(input: ClientAddressInput): string {
  if (input.trustedProxy === 'cloudflare') {
    const header = input.cfConnectingIp?.trim()
    if (header) return header
  }
  return input.socketIp
}
