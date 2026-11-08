import { inject } from '@adonisjs/core'
import type { AssistantTool, ToolContext, ToolOutcome } from '#services/assistant/assistant_tool'
import { toolData } from '#services/assistant/assistant_tool'
import { TripContent } from '#services/trip_content'
import { TripViews } from '#services/trip_views'

/** The budget view the app shows (shared `budget_status`), with each category's key or name. */
@inject()
export class GetBudgetStatusTool implements AssistantTool {
  readonly definition = {
    name: 'get_budget_status',
    description:
      'Budget position in the base currency, integer minor units: total budget, spent, remaining, today allowance (what may be spent per remaining day, today included), spent today, left today, expenses waiting for an exchange rate, committed bookings, and spending per category.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  }

  constructor(
    private readonly content: TripContent,
    private readonly views: TripViews
  ) {}

  async run({ trip }: ToolContext): Promise<ToolOutcome> {
    const rows = await this.content.load(trip.id)
    const budget = await this.views.budget(trip, undefined, rows)
    const categories = new Map(rows.budgetCategories.map((category) => [category.id, category]))
    return toolData(this.definition.name, {
      ...budget,
      perCategory: budget.perCategory.map((line) => {
        const category = line.categoryId ? categories.get(line.categoryId) : undefined
        return {
          ...line,
          key: category?.key ?? null,
          name: category?.name ?? null,
        }
      }),
    })
  }
}
