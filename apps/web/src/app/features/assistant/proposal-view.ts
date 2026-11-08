import type {
  AiAction,
  AiEventChangesProposal,
  AiExpenseProposal,
  AiTaskProposal,
} from '@monkitrips/shared'
import { formatDayDate } from '../../domain/day-date'
import { formatMoney } from '../../domain/money'
import type { IconName } from '../../shared/ui/icon/icon-names'
import type { ProposalChange, ProposalStatus } from '../../shared/ui/proposal/proposal.component'

/** A key of the `assistant` scope with its parameters, translated. */
export type Translate = (key: string, params?: Record<string, string | number>) => string

/** What `<mk-proposal>` shows for one action. */
export interface ProposalView {
  kind: string
  icon: IconName
  title: string
  summary: string | null
  changes: ProposalChange[]
}

const KNOWN_EVENT_FIELDS = new Set([
  'title',
  'kind',
  'status',
  'startsLocal',
  'startTz',
  'endsLocal',
  'endTz',
  'placeName',
  'address',
  'notes',
])

/**
 * The diff of a proposal in the member's language: an expense with its
 * amount, the base-currency value and the rate of the spend day; a task
 * with its due date; event changes field by field (before → after) with
 * the nights that lose or gain a bed flagged by icon and word.
 */
export function proposalView(action: AiAction, t: Translate, locale: string): ProposalView {
  const proposal = action.proposal
  switch (proposal.kind) {
    case 'expense':
      return expenseView(proposal, t, locale)
    case 'task':
      return taskView(proposal, t, locale)
    case 'event_changes':
      return eventChangesView(proposal, t, locale)
  }
}

/** Accepted, rejected, expired or failed as icon plus word; null while it waits for a decision. */
export function proposalStatus(action: AiAction, t: Translate): ProposalStatus | null {
  const label = (status: string) => t(`proposal.status.${status}`)
  switch (action.status) {
    case 'proposed':
      return null
    case 'accepted':
      return { tone: 'good', icon: 'circle-check', label: label('accepted') }
    case 'rejected':
      return { tone: 'neutral', icon: 'circle-x', label: label('rejected') }
    case 'expired':
      return { tone: 'neutral', icon: 'clock', label: label('expired') }
    case 'failed':
      return { tone: 'serious', icon: 'alert-triangle', label: label('failed') }
  }
}

function expenseView(proposal: AiExpenseProposal, t: Translate, locale: string): ProposalView {
  const amount = formatMoney(proposal.amountMinor, proposal.currency, locale)
  const category = proposal.categoryKey
    ? t(`proposal.categories.${proposal.categoryKey}`)
    : (proposal.categoryName ?? t('proposal.categories.other'))
  const changes: ProposalChange[] = [
    { label: t('proposal.expense.amount'), after: amount, mono: true },
  ]
  if (proposal.currency !== proposal.baseCurrency) {
    changes.push({
      label: t('proposal.expense.base', { currency: proposal.baseCurrency }),
      after:
        proposal.baseAmountMinor === null
          ? t('proposal.expense.noRate')
          : formatMoney(proposal.baseAmountMinor, proposal.baseCurrency, locale),
      mono: proposal.baseAmountMinor !== null,
    })
    if (proposal.fxRate && proposal.fxRateDate) {
      changes.push({
        label: t('proposal.expense.rate'),
        // `fxRate` is units of the paid currency per one unit of the base.
        after: t('proposal.expense.rateValue', {
          from: proposal.baseCurrency,
          rate: proposal.fxRate,
          to: proposal.currency,
          date: formatDayDate(proposal.fxRateDate, locale, false),
        }),
      })
    }
  }
  changes.push(
    { label: t('proposal.expense.category'), after: category },
    { label: t('proposal.expense.spentOn'), after: formatDayDate(proposal.spentOn, locale) }
  )
  return {
    kind: t('proposal.kind.expense'),
    icon: 'wallet',
    title: t('proposal.expense.title', { amount, category }),
    summary: proposal.description,
    changes,
  }
}

function taskView(proposal: AiTaskProposal, t: Translate, locale: string): ProposalView {
  return {
    kind: t('proposal.kind.task'),
    icon: 'list-checks',
    title: proposal.title,
    summary: proposal.notes,
    changes: [
      {
        label: t('proposal.task.due'),
        after: proposal.dueOn ? formatDayDate(proposal.dueOn, locale) : t('proposal.task.noDue'),
      },
      {
        label: t('proposal.task.priority'),
        after: t(`proposal.task.priorities.${proposal.priority}`),
      },
    ],
  }
}

function eventChangesView(
  proposal: AiEventChangesProposal,
  t: Translate,
  locale: string
): ProposalView {
  const changes: ProposalChange[] = []
  for (const event of proposal.events) {
    const heading = t('proposal.events.event', {
      op: t(`proposal.events.op.${event.op}`),
      title: event.title,
    })
    if (event.fields.length === 0) {
      changes.push({ label: heading, after: t(`proposal.events.op.${event.op}`) })
    }
    for (const field of event.fields) {
      const fieldLabel = KNOWN_EVENT_FIELDS.has(field.field)
        ? t(`proposal.events.fields.${field.field}`)
        : field.field
      const timed = field.field === 'startsLocal' || field.field === 'endsLocal'
      changes.push({
        label: `${heading} · ${fieldLabel}`,
        before: event.op === 'add' ? undefined : eventValue(field.field, field.before, t, locale),
        after: eventValue(field.field, field.after, t, locale),
        mono: timed,
      })
    }
  }
  for (const night of proposal.nights) {
    const noBed = t('proposal.events.noBed')
    const loses = night.before !== null && night.after === null
    const gains = night.before === null && night.after !== null
    changes.push({
      label: t('proposal.events.night', { date: formatDayDate(night.date, locale) }),
      before: night.before?.title ?? noBed,
      after: night.after?.title ?? noBed,
      ...(loses
        ? {
            flag: {
              tone: 'serious' as const,
              icon: 'alert-triangle' as const,
              label: t('proposal.events.loses'),
            },
          }
        : gains
          ? {
              flag: {
                tone: 'good' as const,
                icon: 'bed' as const,
                label: t('proposal.events.gains'),
              },
            }
          : {}),
    })
  }
  if (proposal.uncoveredBefore !== proposal.uncoveredAfter) {
    changes.push({
      label: t('proposal.events.uncovered'),
      before: String(proposal.uncoveredBefore),
      after: String(proposal.uncoveredAfter),
      mono: true,
    })
  }
  return {
    kind: t('proposal.kind.event_changes'),
    icon: 'calendar',
    title: proposal.summary ?? t('proposal.events.title', { count: proposal.events.length }),
    summary: null,
    changes,
  }
}

/** One event field as people read it: local times with their day, kinds and statuses by name. */
function eventValue(field: string, value: unknown, t: Translate, locale: string): string {
  if (value === null || value === undefined || value === '') {
    return t('proposal.events.none')
  }
  const text = String(value)
  if (
    (field === 'startsLocal' || field === 'endsLocal') &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)
  ) {
    return `${formatDayDate(text.slice(0, 10), locale)} ${text.slice(11, 16)}`
  }
  if (field === 'kind') {
    return t(`proposal.events.kinds.${text}`)
  }
  if (field === 'status') {
    return t(`proposal.events.statuses.${text}`)
  }
  return text
}
