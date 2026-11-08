import db from '@adonisjs/lucid/services/db'
import type { PlannedReminder } from '@monkitrips/shared'

/**
 * `sent_reminders`, written BEFORE a reminder goes out. The insert runs
 * `ON CONFLICT DO NOTHING` on `UNIQUE (user_id, kind, ref_id, fire_at)`:
 * only the worker whose insert returns a row sends, so a reminder reaches
 * a person once even when two replicas plan the same minute.
 */
export class SentReminderLedger {
  /** Records the reminder for `userId`; true when this call is the first to do so. */
  async claim(userId: string, reminder: PlannedReminder, sentAt: Date): Promise<boolean> {
    const inserted = await db.rawQuery<{ rows: { id: number }[] }>(
      `insert into sent_reminders (user_id, trip_id, kind, ref_id, fire_at, sent_at)
       values (?, ?, ?, ?, ?, ?)
       on conflict (user_id, kind, ref_id, fire_at) do nothing
       returning id`,
      [
        userId,
        reminder.tripId,
        reminder.kind,
        reminder.refId,
        reminder.fireAt,
        sentAt.toISOString(),
      ]
    )
    return inserted.rows.length > 0
  }
}
