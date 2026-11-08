import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Cache of forecasts by place, shared by every trip and account: the key is
 * the coordinates rounded to two decimals (about 1 km) and nothing else, so
 * no trip, stop or person is stored. One row per place, replaced when it is
 * older than 30 minutes. Not syncable: the client reads it through
 * `GET /trips/:tripId/weather` and keeps its own copy.
 */
export default class extends BaseSchema {
  protected tableName = 'weather_snapshots'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.decimal('lat', 5, 2).notNullable()
      table.decimal('lng', 6, 2).notNullable()
      table.timestamp('fetched_at', { useTz: true }).notNullable()
      /** `{ forecast: WeatherForecast, attribution: WeatherAttribution }` as the provider answered. */
      table.jsonb('payload').notNullable()

      table.primary(['lat', 'lng'])
      table.check('lat BETWEEN -90 AND 90', [], 'weather_snapshots_lat_check')
      table.check('lng BETWEEN -180 AND 180', [], 'weather_snapshots_lng_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
