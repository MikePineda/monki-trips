import { writeFile } from 'node:fs/promises'
import { args, BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Trip from '#models/trip'
import { TripExporter } from '#services/trip_exporter'

/**
 * `node ace trip:export <tripId> <file>`: writes one trip as a trip JSON v1
 * file, for backups and support. Runs against the database the API is
 * configured for; file documents get download links that expire in five
 * minutes, like the HTTP route.
 */
export default class TripExport extends BaseCommand {
  static commandName = 'trip:export'
  static description = 'Write a trip as a trip JSON v1 file'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Id of the trip (uuid)' })
  declare tripId: string

  @args.string({ description: 'Path of the JSON file to write' })
  declare file: string

  async run() {
    const trip = await Trip.query().where('id', this.tripId).whereNull('deleted_at').first()
    if (!trip) {
      this.logger.error('no live trip has that id')
      this.exitCode = 1
      return
    }
    const exporter = await this.app.container.make(TripExporter)
    const document = await exporter.build(trip)
    await writeFile(this.file, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
    this.logger.success(
      `wrote ${this.file}: ${document.stops.length} stops, ${document.events.length} events, ${document.expenses.length} expenses, ${document.documents.length} documents`
    )
  }
}
