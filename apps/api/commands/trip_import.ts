import { readFile } from 'node:fs/promises'
import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import i18nManager from '@adonisjs/i18n/services/main'
import { errors as vineErrors } from '@vinejs/vine'
import { TRIP_JSON_MAX_BYTES } from '@monkitrips/shared'
import User from '#models/user'
import { TripImporter } from '#services/trip_importer'
import { normalizeEmail } from '#domain/normalize_email'

/**
 * `node ace trip:import <file> --user <email> [--dry-run]`: loads a trip
 * JSON v1 file as a new trip owned by that account, the same way
 * `POST /trips/import` does. Meant for the owner's machine against a local
 * database, and for support; a dry run only validates and prints the summary.
 */
export default class TripImport extends BaseCommand {
  static commandName = 'trip:import'
  static description = 'Load a trip JSON v1 file as a new trip of an account'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Path of the JSON file to read' })
  declare file: string

  @flags.string({
    description: 'E-mail address of the account that will own the trip',
    required: true,
  })
  declare user: string

  @flags.boolean({ description: 'Validate and report without writing anything' })
  declare dryRun: boolean

  async run() {
    const owner = await User.findBy('email', normalizeEmail(this.user))
    if (!owner) {
      this.logger.error('no account matches --user')
      this.exitCode = 1
      return
    }
    const text = await readFile(this.file, 'utf8')
    if (Buffer.byteLength(text) > TRIP_JSON_MAX_BYTES) {
      this.logger.error(`the file is larger than ${TRIP_JSON_MAX_BYTES} bytes`)
      this.exitCode = 1
      return
    }
    let input: unknown
    try {
      input = JSON.parse(text)
    } catch {
      this.logger.error('the file is not valid JSON')
      this.exitCode = 1
      return
    }
    const importer = await this.app.container.make(TripImporter)
    const i18n = i18nManager.locale(owner.locale)
    try {
      const result = await importer.import(owner, input, { dryRun: this.dryRun ?? false }, i18n)
      const { trip, counts, warnings } = result.summary
      this.logger.info(
        `${trip.name} (${trip.startsOn} to ${trip.endsOn}): ${Object.entries(counts)
          .map(([key, value]) => `${value} ${key}`)
          .join(', ')}`
      )
      for (const warning of warnings) this.logger.warning(warning.message)
      if (result.dryRun) {
        this.logger.success('dry run: nothing was written')
      } else {
        this.logger.success(`imported as trip ${result.tripId}`)
      }
    } catch (error) {
      if (!(error instanceof vineErrors.E_VALIDATION_ERROR)) throw error
      for (const problem of error.messages as { field: string; message: string }[]) {
        this.logger.error(`${problem.field}: ${problem.message}`)
      }
      this.logger.error('the file was refused; nothing was written')
      this.exitCode = 1
    }
  }
}
