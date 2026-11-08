import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import { makeUser } from '#tests/helpers/make_user'
import { settleDeferred } from '#tests/helpers/settle_deferred'

export interface CommittedScope {
  /** A user whose rows (and the trips they created) are deleted when the work ends. */
  user(): Promise<User>
}

/**
 * Runs `work` outside the test's global transaction, so every request gets
 * its own connection and real transactions can block on each other's row
 * locks (races, lock order). Everything is committed for real: the users
 * made through the scope, their trips and every row that cascades from
 * them are deleted afterwards, then a fresh global transaction is opened so
 * the suite's teardown still has one to roll back. Use it in a group of
 * its own: rows made in the group's setup are rolled back first.
 */
export async function committedWork<T>(work: (scope: CommittedScope) => Promise<T>): Promise<T> {
  await db.rollbackGlobalTransaction()
  const users: string[] = []
  try {
    return await work({
      async user() {
        const user = await makeUser()
        users.push(user.id)
        return user
      },
    })
  } finally {
    await settleDeferred()
    if (users.length > 0) {
      // `llm_usage` only nulls its user: delete the rows so no other spec counts them.
      await db.from('llm_usage').whereIn('user_id', users).delete()
      await db.from('trips').whereIn('created_by', users).delete()
      await db.from('users').whereIn('id', users).delete()
    }
    await db.beginGlobalTransaction()
  }
}
