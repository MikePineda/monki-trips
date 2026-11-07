import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Sync plumbing shared by every syncable table (created by later
 * migrations): a global change sequence and the `sync_stamp()` trigger
 * function. A `BEFORE INSERT OR UPDATE` trigger with it stamps each row with
 * the writing transaction id (`change_xid xid8`), the next sequence value
 * (`change_seq`) and `updated_at`, so pull can page by
 * `(change_xid, change_seq)` without skipping concurrent transactions.
 * The client never chooses these values: the trigger overwrites them.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery('CREATE SEQUENCE IF NOT EXISTS sync_change_seq')
      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION sync_stamp() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          NEW.change_xid := pg_current_xact_id();
          NEW.change_seq := nextval('sync_change_seq');
          NEW.updated_at := now();
          RETURN NEW;
        END
        $$
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery('DROP FUNCTION IF EXISTS sync_stamp()')
      await db.rawQuery('DROP SEQUENCE IF EXISTS sync_change_seq')
    })
  }
}
