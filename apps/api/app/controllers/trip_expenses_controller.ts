import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { Clock } from '#services/clock'
import { TripExpensesCsv } from '#services/trip_expenses_csv'
import { tripExportFileName } from '#domain/export_file_name'
import { expensesCsvFileName } from '#domain/expenses_csv'

/** The trip's expenses as a file to take away (Trip expenses CSV v1). Any member; 404 to anyone else. */
@inject()
export default class TripExpensesController {
  constructor(
    private readonly clock: Clock,
    private readonly csv: TripExpensesCsv
  ) {}

  async csvFile(ctx: HttpContext): Promise<string> {
    const body = await this.csv.build(ctx.trip)
    const fileName = expensesCsvFileName(tripExportFileName(ctx.trip.name, this.clock.now()))
    ctx.response.header('Content-Type', 'text/csv; charset=utf-8')
    ctx.response.header('Content-Disposition', `attachment; filename="${fileName}"`)
    ctx.response.header('Cache-Control', 'no-store')
    return body
  }
}
