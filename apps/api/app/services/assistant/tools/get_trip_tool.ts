import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { AssistantTool, ToolContext, ToolOutcome } from '#services/assistant/assistant_tool'
import { toolData } from '#services/assistant/assistant_tool'
import { TripContent } from '#services/trip_content'

/** The trip at a glance: dates, zone, base currency, budget and the stops. No names of people. */
@inject()
export class GetTripTool implements AssistantTool {
  readonly definition = {
    name: 'get_trip',
    description:
      'The trip: name, start and end dates, home time zone, base currency, total budget (integer minor units of the base currency) and its stops in order.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  }

  constructor(private readonly content: TripContent) {}

  async run({ trip }: ToolContext): Promise<ToolOutcome> {
    const rows = await this.content.load(trip.id)
    return toolData(this.definition.name, {
      name: trip.name,
      startsOn: trip.startsOn.toISODate(),
      endsOn: trip.endsOn.toISODate(),
      homeTz: trip.homeTz,
      baseCurrency: trip.baseCurrency,
      budgetMode: trip.budgetMode,
      budgetTotalMinor: trip.budgetTotalMinor,
      travellerCount: await this.travellerCount(trip.id),
      stops: rows.stops.map((stop) => ({
        id: stop.id,
        name: stop.name,
        countryCode: stop.countryCode,
        tz: stop.tz,
        arriveOn: stop.arriveOn,
        departOn: stop.departOn,
      })),
    })
  }

  private async travellerCount(tripId: string): Promise<number> {
    const [row] = await db
      .from('travellers')
      .where('trip_id', tripId)
      .whereNull('deleted_at')
      .count('* as n')
    return Number(row.n)
  }
}
