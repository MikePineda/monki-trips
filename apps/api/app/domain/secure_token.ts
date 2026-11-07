import { createHash, randomBytes, randomInt } from 'node:crypto'

/**
 * Tokens that travel by mail or link (verification, reset, invitations) and
 * the 6-digit code typed by hand. The plaintext is shown once; only a sha256
 * is stored, so a database leak reveals no usable secret.
 */

/** 32 random bytes as base64url: safe inside a URL, 43 characters. */
export function generateSecureToken(): string {
  return randomBytes(32).toString('base64url')
}

/** sha256 hex of a plaintext token: what the database stores and looks up. */
export function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex')
}

/** A 6-digit code, zero-padded, uniformly random. */
export function generateVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

/**
 * Hash of a short code, bound to its token so the same code on two tokens
 * hashes differently (the code alone has only a million values).
 */
export function hashCode(code: string, tokenHash: string): string {
  return createHash('sha256').update(`${tokenHash}:${code}`).digest('hex')
}
