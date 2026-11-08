import db from '@adonisjs/lucid/services/db'
import type { PlannedReminder } from '@monkitrips/shared'

/**
 * `sent_reminders`, written BEFORE a reminder goes out. The insert runs
 * `ON CONFLICT DO NOTHING` on `UNIQUE (user_id, kind, ref_id, fire_at)`:
 * only the worker whose insert returns a row sends, so a reminder reaches
 * a person once even when two replicas plan the same minute.
 *
 * - `fire_at` is the reminder's `nominalFireAt` (before quiet hours), so
 *   toggling quiet hours never sends it again; an edited event time is a
 *   new key and is sent again.
 * - `tasks_due` goes out at most once per user and `ref_id` (trip and
 *   trip-local day), whatever its fire time: the day's zone can move during
 *   the day (a flight west) and with it the digest's nine o'clock.
 */
export class SentReminderLedger {
  /** Records the reminder for `userId`; true when this call is the first to do so. */
  async claim(userId: string, reminder: PlannedReminder, sentAt: Date): Promise<boolean> {
    const oncePerRef = reminder.kind === 'tasks_due'
    const inserted = await db.rawQuery<{ rows: { id: number }[] }>(
      `insert into sent_reminders (user_id, trip_id, kind, ref_id, fire_at, sent_at)
       select ?::uuid, ?::uuid, ?::text, ?::text, ?::timestamptz, ?::timestamptz
       where not ?::boolean or not exists (
         select 1 from sent_reminders where user_id = ?::uuid and kind = ?::text and ref_id = ?::text
       )
       on conflict (user_id, kind, ref_id, fire_at) do nothing
       returning id`,
      [
        userId,
        reminder.tripId,
        reminder.kind,
        reminder.refId,
        reminder.nominalFireAt,
        sentAt.toISOString(),
        oncePerRef,
        userId,
        reminder.kind,
        reminder.refId,
      ]
    )
    return inserted.rows.length > 0
  }

  /**
   * Forgets a claim whose send reached no device for a transient reason, so
   * the next minute tries again while the reminder is still in its window.
   */
  async release(userId: string, reminder: PlannedReminder): Promise<void> {
    await db
      .from('sent_reminders')
      .where('user_id', userId)
      .where('kind', reminder.kind)
      .where('ref_id', reminder.refId)
      .where('fire_at', reminder.nominalFireAt)
      .delete()
  }
}
