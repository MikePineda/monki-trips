import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'
import { Clock } from '#services/clock'
import { LlmUsageService } from '#services/llm/llm_usage_service'
import { maskEmail } from '#domain/mask_email'
import { usageMonthFromKey, usageMonthOf } from '#domain/usage_month'

/**
 * `node ace llm:usage [--month YYYY-MM]`: LLM calls, tokens and cost per
 * account for one UTC month (the current one by default), biggest spender
 * first, against each account's cap. Accounts appear by id and masked
 * address only; prompts and answers are never stored, so never printed.
 */
export default class LlmUsage extends BaseCommand {
  static commandName = 'llm:usage'
  static description = 'Print LLM usage per account for a month'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'UTC month as YYYY-MM (default: the current month)' })
  declare month?: string

  async run() {
    const clock = await this.app.container.make(Clock)
    const month = this.month ? usageMonthFromKey(this.month) : usageMonthOf(clock.now())
    if (!month) {
      this.logger.error('--month must be YYYY-MM')
      this.exitCode = 1
      return
    }
    const usage = await this.app.container.make(LlmUsageService)
    const totals = await usage.totalsByUser(month)
    if (totals.length === 0) {
      this.logger.info(`no LLM calls in ${month.key}`)
      return
    }
    const ids = totals.map((row) => row.userId).filter((id): id is string => id !== null)
    const accounts = await User.query().whereIn('id', ids)
    const users = new Map(accounts.map((user) => [user.id, user]))

    const table = this.ui.table()
    table.head(['account', 'address', 'calls', 'tokens in', 'tokens out', 'cap', 'cost USD'])
    for (const row of totals) {
      const user = row.userId ? users.get(row.userId) : undefined
      table.row([
        row.userId ?? '(deleted)',
        user ? maskEmail(user.email) : '-',
        String(row.calls),
        String(row.inputTokens),
        String(row.outputTokens),
        user ? String(usage.capFor(user)) : '-',
        row.costMicros === null ? 'n/a' : (row.costMicros / 1_000_000).toFixed(4),
      ])
    }
    this.logger.info(`LLM usage in ${month.key} (UTC)`)
    table.render()
  }
}
