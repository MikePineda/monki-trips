import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { UserTokenPurpose } from '@monkitrips/shared'
import User from '#models/user'
import UserToken from '#models/user_token'
import { Clock } from '#services/clock'
import { ApiException } from '#exceptions/api_exception'
import {
  generateSecureToken,
  generateVerificationCode,
  hashCode,
  hashToken,
} from '#domain/secure_token'
import { USER_TOKEN_RULES, userTokenExpiry, userTokenState } from '#domain/user_token_rules'

export interface IssuedUserToken {
  /** Plaintext for the link; never stored. */
  token: string
  /** Plaintext 6-digit code (verification only); never stored. */
  code?: string
}

/**
 * Issues and consumes the single-use tokens behind e-mail verification and
 * password reset. Issuing a new token of a purpose deletes the person's
 * previous ones, so only the latest mail works.
 */
@inject()
export class UserTokens {
  constructor(private readonly clock: Clock) {}

  async issue(user: User, purpose: UserTokenPurpose): Promise<IssuedUserToken> {
    const now = this.clock.now()
    const token = generateSecureToken()
    const tokenHash = hashToken(token)
    const code = purpose === 'verify_email' ? generateVerificationCode() : undefined

    await UserToken.query().where('user_id', user.id).where('purpose', purpose).delete()
    await UserToken.create({
      userId: user.id,
      purpose,
      tokenHash,
      codeHash: code ? hashCode(code, tokenHash) : null,
      attempts: 0,
      expiresAt: DateTime.fromJSDate(userTokenExpiry(purpose, now)),
    })
    return { token, code }
  }

  /**
   * Consumes a link token. Unknown, used, exhausted or expired tokens all
   * answer 410 `E_TOKEN_EXPIRED`: the person asks for a new mail. Of two
   * concurrent requests with one token only one wins (see `markUsed`).
   */
  async consumeByToken(plain: string, purpose: UserTokenPurpose): Promise<User> {
    const row = await UserToken.query()
      .where('token_hash', hashToken(plain))
      .where('purpose', purpose)
      .preload('user')
      .first()
    if (!row || userTokenState(this.facts(row), this.clock.now()) !== 'valid') {
      throw new ApiException('E_TOKEN_EXPIRED')
    }
    await this.markUsed(row)
    return row.user
  }

  /**
   * Consumes the person's current verification code. Every guess first
   * takes one of the token's attempts in a single conditional UPDATE, so
   * parallel guesses can never exceed the cap. A wrong code answers 400
   * `E_INVALID_CODE`; the guess that takes the last attempt, and any after
   * it, answer 410 `E_TOKEN_EXPIRED`, as does expiry.
   */
  async consumeByCode(user: User, code: string): Promise<void> {
    const row = await UserToken.query()
      .where('user_id', user.id)
      .where('purpose', 'verify_email')
      .orderBy('created_at', 'desc')
      .first()
    if (!row || userTokenState(this.facts(row), this.clock.now()) !== 'valid') {
      throw new ApiException('E_TOKEN_EXPIRED')
    }
    const { maxAttempts } = USER_TOKEN_RULES[row.purpose]
    const taken = await db
      .from('user_tokens')
      .where('id', row.id)
      .whereNull('used_at')
      .where('attempts', '<', maxAttempts)
      .increment('attempts', 1)
      .returning('attempts')
    if (taken.length === 0) throw new ApiException('E_TOKEN_EXPIRED')

    if (row.codeHash !== hashCode(code, row.tokenHash)) {
      const attempts = Number((taken[0] as { attempts: number }).attempts)
      throw new ApiException(attempts >= maxAttempts ? 'E_TOKEN_EXPIRED' : 'E_INVALID_CODE')
    }
    await this.markUsed(row)
  }

  private facts(row: UserToken) {
    return {
      purpose: row.purpose,
      expiresAt: row.expiresAt.toJSDate(),
      usedAt: row.usedAt?.toJSDate() ?? null,
      attempts: row.attempts,
    }
  }

  /** Stamps `used_at` only if nobody did first; a lost race answers 410. */
  private async markUsed(row: UserToken) {
    const usedAt = this.clock.now()
    const marked = await db
      .from('user_tokens')
      .where('id', row.id)
      .whereNull('used_at')
      .update({ used_at: usedAt }, ['id'])
    if (marked.length === 0) throw new ApiException('E_TOKEN_EXPIRED')
    row.usedAt = DateTime.fromJSDate(usedAt)
  }
}
