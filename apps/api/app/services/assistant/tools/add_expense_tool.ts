import { randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import vine from '@vinejs/vine'
import {
  DEFAULT_BUDGET_CATEGORY_KEYS,
  majorAmountToMinor,
  type AiExpenseProposal,
  type BudgetCategory,
  type SyncMutation,
} from '@monkitrips/shared'
import type { AssistantTool, ToolContext, ToolOutcome } from '#services/assistant/assistant_tool'
import { ToolInputError, toolData } from '#services/assistant/assistant_tool'
import { MutationDryRun } from '#services/assistant/mutation_dry_run'
import { ProposalRecorder } from '#services/assistant/proposal_recorder'
import { validateToolInput } from '#services/assistant/tool_input'
import { Clock } from '#services/clock'
import { FxRates } from '#services/fx/fx_rates'
import { TripViews } from '#services/trip_views'

const input = vine.compile(
  vine.object({
    amount: vine
      .string()
      .trim()
      .regex(/^-?\d+(?:\.\d+)?$/),
    currency: vine
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toUpperCase()),
    category: vine.string().trim().minLength(1).maxLength(80).optional(),
    spentOn: vine
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    description: vine.string().trim().minLength(1).maxLength(200).optional(),
  })
)

interface ExpenseInput {
  amount: string
  currency: string
  category?: string
  spentOn?: string
  description?: string
}

/** The trip category a word names: a default key (`food`), else a custom name, case-insensitive. */
function categoryFor(categories: BudgetCategory[], wanted: string | undefined) {
  if (!wanted) return categories.find((category) => category.key === 'other') ?? null
  const needle = wanted.trim().toLowerCase()
  return (
    categories.find((category) => category.key === needle) ??
    categories.find((category) => category.name?.trim().toLowerCase() === needle) ??
    categories.find((category) => category.key === 'other') ??
    null
  )
}

/**
 * Drafts an expense in the currency paid ("350 baht of pad thai" is 350.00
 * THB under food). The exchange rate of the spend day is looked up first
 * (cache or provider) so the proposal shows the amount in the trip's base
 * currency, then the expense runs through the sync entity in a rolled-back
 * dry run. Nothing is written until the member accepts.
 */
@inject()
export class AddExpenseTool implements AssistantTool {
  readonly definition = {
    name: 'add_expense',
    description: `Propose an expense for the member to accept. amount is a decimal in the currency's major units as a string ("350", "12.50"; negative for a refund); currency is ISO 4217 (THB, EUR); category is one of ${DEFAULT_BUDGET_CATEGORY_KEYS.join(', ')} or a custom category name; spentOn defaults to today. Returns the draft with its value in the base currency.`,
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'string', description: 'Decimal in major units, e.g. "350" or "12.50"' },
        currency: { type: 'string', description: 'ISO 4217 code, e.g. THB' },
        category: { type: 'string' },
        spentOn: { type: 'string', description: 'YYYY-MM-DD' },
        description: { type: 'string' },
      },
      required: ['amount', 'currency'],
      additionalProperties: false,
    },
  }

  constructor(
    private readonly views: TripViews,
    private readonly fx: FxRates,
    private readonly dryRun: MutationDryRun,
    private readonly recorder: ProposalRecorder,
    private readonly clock: Clock
  ) {}

  async run(ctx: ToolContext, raw: Record<string, unknown>): Promise<ToolOutcome> {
    const amount = typeof raw['amount'] === 'number' ? String(raw['amount']) : raw['amount']
    const expense = await validateToolInput<ExpenseInput>(input, { ...raw, amount })
    const minor = majorAmountToMinor(expense.amount, expense.currency)
    if (minor === null || minor === 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new ToolInputError(
        `Invalid input: amount (decimals). ${expense.currency} amounts must be non-zero with at most the currency's decimals.`
      )
    }
    let spentOn = expense.spentOn
    if (!spentOn) {
      const { date } = await this.views.today(ctx.trip)
      spentOn = date
    }

    // Like a sync push's `prepare`: fetch the rate before the transaction, which then reads the cache.
    await this.fx.find(ctx.trip.baseCurrency, expense.currency, spentOn).catch(() => null)

    let category: BudgetCategory | null = null
    const { after, baseline, mutations } = await this.dryRun.run(
      ctx.user,
      ctx.trip,
      ctx.i18n,
      ({ budgetCategories }) => {
        category = categoryFor(budgetCategories, expense.category)
        const mutation: SyncMutation = {
          mutationId: randomUUID(),
          tripId: ctx.trip.id,
          entity: 'expense',
          op: 'upsert',
          id: randomUUID(),
          changes: {
            amountMinor: Number(minor),
            currency: expense.currency,
            spentOn,
            categoryId: category?.id ?? null,
            description: expense.description ?? null,
          },
          changedAt: this.clock.now().toISOString(),
        }
        return [mutation]
      }
    )
    const chosen = category as BudgetCategory | null
    const row = after.expenses.find((one) => one.id === mutations[0].id)!
    const proposal: AiExpenseProposal = {
      kind: 'expense',
      expenseId: row.id,
      amountMinor: row.amountMinor,
      currency: row.currency,
      categoryId: row.categoryId,
      categoryKey: chosen?.key ?? null,
      categoryName: chosen?.name ?? null,
      spentOn: row.spentOn,
      description: row.description,
      baseCurrency: ctx.trip.baseCurrency,
      baseAmountMinor: row.baseAmountMinor,
      fxRate: row.fxRate,
      fxRateDate: row.fxRateDate,
      fxSource: row.fxSource,
    }
    const action = await this.recorder.record(ctx, 'add_expense', proposal, mutations, baseline)
    return { ...toolData(this.definition.name, ProposalRecorder.forModel(action)), action }
  }
}
