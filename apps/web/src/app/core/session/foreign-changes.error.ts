import type { SessionUser } from './session-api'

/**
 * A sign-in (or signup) on a device whose outbox still holds changes made
 * by another account. Nothing local changed yet: the person either
 * discards those changes and continues as `user`
 * (`SessionStore.discardForeignChanges`) or keeps them and signs the new
 * account out again (`SessionStore.abandonSignIn`), so the other account
 * can sign back in and send them.
 */
export class ForeignChangesError extends Error {
  constructor(
    /** The account the server just signed in. */
    readonly user: SessionUser,
    /** Outbox entries (pending, syncing or failed) of the other account. */
    readonly count: number
  ) {
    super(`This device has ${count} unsynced changes from another account`)
    this.name = 'ForeignChangesError'
  }
}
