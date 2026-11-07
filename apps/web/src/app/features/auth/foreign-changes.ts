import { firstValueFrom } from 'rxjs'
import type { ForeignChangesError } from '../../core/session/foreign-changes.error'
import type { SessionStore } from '../../core/session/session.store'
import type { SheetService } from '../../shared/ui/sheet/sheet.service'
import { ForeignChangesSheet, type ForeignChangesSheetData } from './foreign-changes.sheet'

/**
 * Lets the person decide about another account's unsynced changes after
 * the server signed them in: discard them and continue (true), or keep
 * them and end the new server session (false).
 */
export async function resolveForeignChanges(
  error: ForeignChangesError,
  sheets: SheetService,
  session: SessionStore
): Promise<boolean> {
  const ref = sheets.open<boolean, ForeignChangesSheetData>(ForeignChangesSheet, {
    data: { count: error.count },
  })
  if (await firstValueFrom(ref.closed)) {
    await session.discardForeignChanges(error.user)
    return true
  }
  await session.abandonSignIn()
  return false
}
