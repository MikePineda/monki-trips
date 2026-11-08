import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { balances, budgetStatus, type Balances, type BudgetStatus } from '@monkitrips/shared'
import { scopedLabels } from '../../core/i18n/scoped-labels'
import { LangStore } from '../../core/i18n/lang.store'
import { CLOCK } from '../../core/offline/clock'
import type { ExpenseRecord } from '../../core/offline/records'
import { SyncService } from '../../core/offline/sync.service'
import { TIME_ZONE } from '../../core/offline/time-zone'
import {
  tripBudgetCategories,
  tripEvents,
  tripExpenseShares,
  tripExpenses,
  tripMembers,
  tripRecord,
  tripStops,
  tripTravellers,
} from '../../core/offline/trip-queries'
import { SessionStore } from '../../core/session/session.store'
import { budgetBars, type BudgetBar } from '../../domain/budget-bars'
import { countKey } from '../../domain/count-key'
import { formatDayDate } from '../../domain/day-date'
import { EXPENSE_PHASES, groupExpensesByDay, type ExpensePhase } from '../../domain/expense-groups'
import { formatLocaleFor } from '../../domain/locale'
import { formatMoney, mixesCurrencies } from '../../domain/money'
import { tripRole } from '../../domain/trip-role'
import { splitShares } from '../../domain/split-draft'
import { tripToday } from '../../domain/trip-today'
import { MkBannerComponent } from '../../shared/ui/banner/banner.component'
import { MkBarChartComponent, type ChartBar } from '../../shared/ui/bar-chart/bar-chart.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkChipComponent } from '../../shared/ui/chip/chip.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkIconButtonComponent } from '../../shared/ui/icon-button/icon-button.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkSegmentedComponent } from '../../shared/ui/segmented/segmented.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkStatRowComponent } from '../../shared/ui/stat-tile/stat-row.component'
import { MkStatTileComponent } from '../../shared/ui/stat-tile/stat-tile.component'
import {
  MkTableComponent,
  type TableColumn,
  type TableRow,
} from '../../shared/ui/table/table.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { BudgetEditSheet, type BudgetEditData } from './budget-edit.sheet'
import { CATEGORY_LABEL_KEYS, categoryLabel } from './category-label'
import {
  ExpenseEditSheet,
  type ExpenseEditData,
  type ExpenseEditResult,
} from './expense-edit.sheet'
import { provideMoneyI18n } from './money-i18n'
import { MoneyStore } from './money.store'

type MoneyView = 'budget' | 'expenses' | 'balances'
type BudgetView = 'chart' | 'table'

interface StatTile {
  id: 'spent' | 'remaining' | 'perDay'
  eyebrow: string
  value: string
  sub?: string
}

/** Words the page writes from code: view labels, table headers, the uncategorised line. */
const WORDS = [
  'views.budget',
  'views.expenses',
  'views.balances',
  'budget.chart',
  'budget.table',
  'budget.columns.category',
  'budget.columns.spent',
  'budget.columns.budget',
  'budget.columns.left',
  'budget.uncategorised',
  'budget.noBudget',
  'budget.over',
] as const

/**
 * The Money tab, read from the device only: three figures from the shared
 * budget status (spent, remaining, per day), then "Budget | Expenses".
 * Budget draws spend per category as horizontal bars against each
 * category's budget, with the same numbers in a table view, and edits the
 * budget. Expenses lists everything by day with its phase (before or
 * during the trip), filters by category and phase, and edits or deletes
 * an expense with undo. Expenses waiting for a rate are counted, not
 * summed, exactly as the shared domain does. A trip in split mode says
 * who paid each expense and between how many, and adds "Balances": each
 * traveller's net from the shared `balances` function and the fewest
 * transfers that settle the trip, each one recorded with "Mark as
 * settled" through the outbox. Shared mode hides all of it.
 */
@Component({
  selector: 'app-money-page',
  imports: [
    TranslocoPipe,
    MkBannerComponent,
    MkBarChartComponent,
    MkButtonComponent,
    MkChipComponent,
    MkEmptyStateComponent,
    MkIconButtonComponent,
    MkIconComponent,
    MkListComponent,
    MkListRowComponent,
    MkRowComponent,
    MkSectionComponent,
    MkSegmentedComponent,
    MkStackComponent,
    MkStatRowComponent,
    MkStatTileComponent,
    MkTableComponent,
    MkTextComponent,
  ],
  providers: [provideMoneyI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="3">
      <h1 mk-text variant="title" data-testid="money.title">{{ 'money.title' | transloco }}</h1>

      <mk-stat-row data-testid="money.stats">
        @for (tile of tiles(); track tile.id) {
          <mk-stat-tile
            [eyebrow]="tile.eyebrow"
            [value]="tile.value"
            [sub]="tile.sub"
            [attr.data-testid]="'money.stat.' + tile.id"
          />
        }
      </mk-stat-row>

      <mk-segmented
        role="tablist"
        [options]="views()"
        [value]="activeView()"
        (valueChange)="selectView($event)"
        [label]="'money.views.label' | transloco"
        testId="money.view"
      />

      @if (activeView() === 'budget') {
        <mk-stack gap="2">
          @if (bars().length === 0) {
            <mk-empty-state
              icon="wallet"
              [title]="'money.budget.empty.title' | transloco"
              [body]="'money.budget.empty.body' | transloco"
              data-testid="money.budget.empty"
            />
          } @else {
            <mk-row justify="between" gap="2" [wrap]="true">
              <mk-segmented
                role="tablist"
                [options]="budgetViews()"
                [(value)]="budgetView"
                [label]="'money.budget.viewLabel' | transloco"
                testId="money.budget.view"
              />
              <button
                mk-button
                variant="secondary"
                size="sm"
                type="button"
                data-testid="money.budget.edit"
                (click)="editBudget()"
              >
                <mk-icon name="pencil" [size]="16" />
                {{ 'money.budget.edit' | transloco }}
              </button>
            </mk-row>
            <mk-section [eyebrow]="'money.budget.caption' | transloco">
              @if (budgetView() === 'table') {
                <mk-table
                  [caption]="'money.budget.caption' | transloco"
                  [columns]="tableColumns()"
                  [rows]="tableRows()"
                  testId="money.budget.table"
                />
              } @else {
                <mk-bar-chart [bars]="chartBars()" testId="money.budget.chart" />
              }
            </mk-section>
          }
        </mk-stack>
      } @else if (activeView() === 'balances') {
        @if (balanceView(); as view) {
          <mk-stack gap="2">
            @if (view.pendingFxCount > 0) {
              <mk-banner
                icon="clock"
                [title]="
                  (view.pendingFxCount === 1
                    ? 'money.balances.waitingOne'
                    : 'money.balances.waitingOther'
                  ) | transloco: { count: view.pendingFxCount }
                "
                data-testid="money.balances.waiting"
              />
            }
            <mk-section [eyebrow]="'money.balances.people' | transloco">
              <mk-list>
                @for (row of balanceRows(); track row.id) {
                  <mk-list-row
                    [title]="row.name"
                    [meta]="row.meta"
                    [value]="row.value"
                    testId="money.balance"
                    [attr.data-traveller-id]="row.id"
                  />
                }
              </mk-list>
            </mk-section>
            <mk-section [eyebrow]="'money.balances.settleUp' | transloco">
              @if (settlementRows().length === 0) {
                <mk-empty-state
                  icon="check"
                  [title]="'money.balances.allSettled.title' | transloco"
                  [body]="'money.balances.allSettled.body' | transloco"
                  data-testid="money.balances.allSettled"
                />
              } @else {
                <mk-list>
                  @for (row of settlementRows(); track row.id) {
                    <mk-list-row [title]="row.title" [value]="row.value" testId="money.settlement">
                      <span mkRowExtra>
                        <button
                          mk-button
                          variant="secondary"
                          size="sm"
                          type="button"
                          data-testid="money.settle.mark"
                          (click)="markSettled(row)"
                        >
                          <mk-icon name="check" [size]="16" />
                          {{ 'money.balances.mark' | transloco }}
                        </button>
                      </span>
                    </mk-list-row>
                  }
                </mk-list>
              }
            </mk-section>
            @if (settledRows().length > 0) {
              <mk-section [eyebrow]="'money.balances.history' | transloco">
                <mk-list>
                  @for (row of settledRows(); track row.id) {
                    <mk-list-row
                      [title]="row.title"
                      [meta]="row.meta"
                      [value]="row.value"
                      testId="money.settled"
                    />
                  }
                </mk-list>
              </mk-section>
            }
          </mk-stack>
        }
      } @else {
        <mk-stack gap="2">
          <mk-row
            gap="1"
            [wrap]="true"
            role="group"
            [attr.aria-label]="'money.expenses.filters' | transloco"
            data-testid="money.filters"
          >
            @for (phase of phases; track phase) {
              <mk-chip
                [selectable]="true"
                [selected]="phaseFilter().has(phase)"
                (selectedChange)="togglePhase(phase, $event)"
                data-testid="money.filter.phase"
                [attr.data-phase]="phase"
              >
                {{ 'money.phase.' + phase | transloco }}
              </mk-chip>
            }
            @for (category of categoryOptions(); track category.id) {
              <mk-chip
                [selectable]="true"
                [selected]="categoryFilter().has(category.id)"
                (selectedChange)="toggleCategory(category.id, $event)"
                data-testid="money.filter.category"
                [attr.data-category-id]="category.id"
              >
                {{ category.label }}
              </mk-chip>
            }
          </mk-row>

          @if (expenses().length === 0) {
            <mk-empty-state
              icon="wallet"
              [title]="'money.expenses.empty.title' | transloco"
              [body]="'money.expenses.empty.body' | transloco"
              data-testid="money.expenses.empty"
            />
          } @else if (groups().length === 0) {
            <mk-empty-state
              icon="wallet"
              [title]="'money.expenses.noMatch.title' | transloco"
              [body]="'money.expenses.noMatch.body' | transloco"
              data-testid="money.expenses.noMatch"
            />
          }
          @for (group of groups(); track group.date) {
            <mk-section data-testid="money.day" [attr.data-date]="group.date">
              <mk-row justify="between" gap="1">
                <p mk-text variant="eyebrow" tone="ink-3">{{ day(group.date) }}</p>
                <mk-chip variant="tag" data-testid="money.day.phase">
                  {{ 'money.phase.' + group.phase | transloco }}
                </mk-chip>
              </mk-row>
              <mk-list>
                @for (expense of group.expenses; track expense.id) {
                  <mk-list-row
                    [title]="titleOf(expense)"
                    [meta]="metaOf(expense)"
                    [value]="amountOf(expense)"
                    testId="money.expense"
                    [attr.data-expense-id]="expense.id"
                  >
                    <button
                      mkRowTrailing
                      mk-icon-button
                      size="sm"
                      type="button"
                      [attr.aria-label]="'money.expenses.row.edit' | transloco"
                      data-testid="money.expense.edit"
                      (click)="edit(expense)"
                    >
                      <mk-icon name="pencil" />
                    </button>
                  </mk-list-row>
                }
              </mk-list>
            </mk-section>
          }
        </mk-stack>
      }
    </mk-stack>
  `,
})
export default class MoneyPage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()

  private readonly store = inject(MoneyStore)
  private readonly sync = inject(SyncService)
  private readonly sheets = inject(SheetService)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)
  private readonly lang = inject(LangStore)
  private readonly session = inject(SessionStore)
  private readonly clock = inject(CLOCK)
  private readonly deviceZone = inject(TIME_ZONE)

  protected readonly trip = tripRecord(this.tripId)
  /** Every expense of the trip, settlements included (what balances count). */
  private readonly allExpenses = tripExpenses(this.tripId)
  /** Money spent: the budget, the bars and the list leave settlements out. */
  protected readonly expenses = computed(() =>
    this.allExpenses().filter((expense) => expense.kind !== 'settlement')
  )
  private readonly settlementExpenses = computed(() =>
    this.allExpenses()
      .filter((expense) => expense.kind === 'settlement')
      .sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.updatedAt.localeCompare(a.updatedAt))
  )
  private readonly categories = tripBudgetCategories(this.tripId)
  private readonly stops = tripStops(this.tripId)
  private readonly events = tripEvents(this.tripId)
  private readonly members = tripMembers(this.tripId)
  private readonly travellers = tripTravellers(this.tripId)
  private readonly shares = tripExpenseShares(this.tripId)

  private readonly words = scopedLabels('money', WORDS)
  private readonly categoryWords = scopedLabels('money', CATEGORY_LABEL_KEYS)
  private readonly now = signal(this.clock())

  protected readonly phases = EXPENSE_PHASES.filter((phase) => phase !== 'after')
  protected readonly view = signal<MoneyView>('budget')
  protected readonly budgetView = signal<BudgetView>('chart')
  protected readonly phaseFilter = signal<ReadonlySet<ExpensePhase>>(new Set())
  protected readonly categoryFilter = signal<ReadonlySet<string | null>>(new Set())

  private readonly locale = computed(() => formatLocaleFor(this.lang.lang()))
  private readonly base = computed(() => this.trip()?.baseCurrency ?? 'EUR')
  private readonly today = computed(() => tripToday(this.now(), this.deviceZone, this.stops()).date)
  /** The trip mixes currencies: shared symbols get their prefix (`A$`). */
  private readonly mixed = computed(() =>
    mixesCurrencies(
      this.base(),
      this.expenses().map((expense) => expense.currency)
    )
  )

  /** The shared domain's money view of the trip, the same code the API runs. */
  protected readonly status = computed<BudgetStatus | null>(() => {
    const trip = this.trip()
    if (!trip) return null
    return budgetStatus({
      startsOn: trip.startDate,
      endsOn: trip.endDate,
      budgetTotalMinor: trip.budgetTotalMinor ?? null,
      baseCurrency: trip.baseCurrency,
      today: this.today(),
      expenses: this.expenses().map((expense) => ({
        id: expense.id,
        eventId: expense.eventId,
        amountMinor: expense.amountMinor,
        currency: expense.currency,
        baseAmountMinor: expense.baseAmountMinor,
        spentOn: expense.spentOn,
        syncPending: expense.syncState === 'pending',
      })),
    })
  })

  protected readonly tiles = computed<StatTile[]>(() => {
    this.words()
    const status = this.status()
    if (!status) return []
    const t = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`money.stats.${key}`, params)
    const money = (minor: bigint) => this.money(minor, this.base())
    const spent: StatTile = {
      id: 'spent',
      eyebrow: t('spent'),
      value: money(status.spentMinor),
      sub:
        status.pendingFxCount > 0
          ? t(countKey('waiting', status.pendingFxCount), { count: status.pendingFxCount })
          : status.budgetMinor !== null
            ? t('ofBudget', { amount: money(status.budgetMinor) })
            : undefined,
    }
    const remaining: StatTile =
      status.remainingMinor === null
        ? { id: 'remaining', eyebrow: t('remaining'), value: t('noBudget'), sub: t('setBudget') }
        : {
            id: 'remaining',
            eyebrow: t('remaining'),
            value: money(status.remainingMinor),
            sub: status.remainingMinor < 0n ? t('overBudget') : undefined,
          }
    const perDay: StatTile = {
      id: 'perDay',
      eyebrow: t('perDay'),
      value: status.allowanceTodayMinor === null ? '—' : money(status.allowanceTodayMinor),
      // The days the shared rule divided by: the trip's days before it, the days left during it.
      sub:
        status.phase === 'past'
          ? t('tripEnded')
          : status.allowanceTodayMinor === null
            ? undefined
            : t(
                countKey(
                  status.phase === 'upcoming' ? 'tripDays' : 'daysLeft',
                  status.allowanceDays
                ),
                {
                  count: status.allowanceDays,
                }
              ),
    }
    return [spent, remaining, perDay]
  })

  protected readonly splitMode = computed(() => this.trip()?.budgetMode === 'split')
  /** "Balances" leaves with split mode: the page falls back to the budget. */
  protected readonly activeView = computed<MoneyView>(() =>
    this.view() === 'balances' && !this.splitMode() ? 'budget' : this.view()
  )
  protected readonly views = computed(() => [
    { id: 'budget', label: this.words()[0] },
    { id: 'expenses', label: this.words()[1] },
    ...(this.splitMode() ? [{ id: 'balances', label: this.words()[2] }] : []),
  ])

  private readonly sharesByExpense = computed(() => {
    const byExpense = new Map<string, number>()
    for (const share of this.shares()) {
      byExpense.set(share.expenseId, (byExpense.get(share.expenseId) ?? 0) + 1)
    }
    return byExpense
  })
  /** The owner's traveller: who paid an expense that names nobody, as the server assigns it. */
  private readonly ownerTravellerId = computed(() => {
    const owner = this.members().find((member) => member.role === 'owner')
    return this.travellers().find((row) => owner && row.userId === owner.userId)?.id ?? null
  })

  /** Who owes whom, from the same shared function the API answers `/balances` with. */
  protected readonly balanceView = computed<Balances | null>(() => {
    if (!this.splitMode()) return null
    return balances({
      travellers: this.travellers().map((row) => row.id),
      expenses: this.allExpenses(),
      shares: this.shares(),
      defaultPayerTravellerId: this.ownerTravellerId(),
    })
  })

  protected readonly balanceRows = computed(() => {
    this.words()
    const view = this.balanceView()
    if (!view) return []
    return view.balances.map((row) => {
      const state = row.netMinor > 0n ? 'getsBack' : row.netMinor < 0n ? 'owes' : 'settled'
      const abs = row.netMinor < 0n ? -row.netMinor : row.netMinor
      return {
        id: row.travellerId,
        name: this.travellerName(row.travellerId),
        meta: this.transloco.translate('money.balances.row', {
          state: this.transloco.translate(`money.balances.${state}`),
          paid: this.money(row.paidMinor, this.base()),
          owed: this.money(row.owedMinor, this.base()),
        }),
        value: this.money(abs, this.base()),
      }
    })
  })

  /** "Settled": the settlements already recorded, newest first. */
  protected readonly settledRows = computed(() => {
    this.words()
    const shares = this.shares()
    return this.settlementExpenses().map((expense) => {
      const to = shares.find((share) => share.expenseId === expense.id)?.travellerId ?? null
      return {
        id: expense.id,
        title: this.transloco.translate('money.balances.paid', {
          from: this.travellerName(expense.paidByTravellerId),
          to: this.travellerName(to),
        }),
        meta: this.day(expense.spentOn),
        value: this.money(BigInt(expense.amountMinor), expense.currency),
      }
    })
  })

  protected readonly settlementRows = computed(() => {
    this.words()
    const view = this.balanceView()
    if (!view) return []
    return view.settlements.map((transfer) => ({
      id: `${transfer.fromTravellerId}>${transfer.toTravellerId}`,
      from: transfer.fromTravellerId,
      to: transfer.toTravellerId,
      amountMinor: transfer.amountMinor,
      title: this.transloco.translate('money.balances.pays', {
        from: this.travellerName(transfer.fromTravellerId),
        to: this.travellerName(transfer.toTravellerId),
      }),
      value: this.money(transfer.amountMinor, this.base()),
    }))
  })
  protected readonly budgetViews = computed(() => [
    { id: 'chart', label: this.words()[3] },
    { id: 'table', label: this.words()[4] },
  ])

  /** The budget per category, with labels: one source for the chart and the table. */
  protected readonly bars = computed(() =>
    budgetBars(this.categories(), this.expenses()).map((bar) => ({
      ...bar,
      label: this.barLabel(bar),
    }))
  )

  protected readonly chartBars = computed<ChartBar[]>(() => {
    const [, , , , , , , , , , noBudget, over] = this.words()
    return this.bars().map((bar) => ({
      id: bar.categoryId ?? 'none',
      label: bar.label,
      value: Number(bar.spentMinor),
      target: bar.budgetMinor === null ? null : Number(bar.budgetMinor),
      valueText: this.money(bar.spentMinor, this.base()),
      targetText:
        bar.budgetMinor === null
          ? noBudget
          : this.transloco.translate('money.budget.of', {
              amount: this.money(bar.budgetMinor, this.base()),
            }),
      ...(bar.overBudget
        ? { status: { tone: 'serious' as const, icon: 'alert-triangle' as const, label: over } }
        : {}),
    }))
  })

  protected readonly tableColumns = computed<TableColumn[]>(() => {
    const words = this.words()
    return [
      { id: 'category', label: words[5] },
      { id: 'spent', label: words[6], align: 'end' },
      { id: 'budget', label: words[7], align: 'end' },
      { id: 'left', label: words[8], align: 'end' },
    ]
  })

  protected readonly tableRows = computed<TableRow[]>(() => {
    const noBudget = this.words()[10]
    return this.bars().map((bar) => ({
      id: bar.categoryId ?? 'none',
      cells: {
        category: bar.label,
        spent: this.money(bar.spentMinor, this.base()),
        budget: bar.budgetMinor === null ? noBudget : this.money(bar.budgetMinor, this.base()),
        left:
          bar.budgetMinor === null ? '' : this.money(bar.budgetMinor - bar.spentMinor, this.base()),
      },
    }))
  })

  protected readonly categoryOptions = computed(() =>
    this.categories().map((category) => ({
      id: category.id,
      label: categoryLabel(category, this.categoryWords()),
    }))
  )

  protected readonly groups = computed(() => {
    const trip = this.trip()
    if (!trip) return []
    return groupExpensesByDay(
      this.expenses(),
      { startsOn: trip.startDate, endsOn: trip.endDate },
      { phases: this.phaseFilter(), categoryIds: this.categoryFilter() }
    )
  })

  private readonly role = computed(() =>
    tripRole(this.members(), this.session.user()?.id, this.trip()?.role)
  )

  constructor() {
    this.sync.requestSync()
  }

  protected day(isoDate: string): string {
    return formatDayDate(isoDate, this.locale())
  }

  protected titleOf(expense: ExpenseRecord): string {
    return expense.description || this.categoryName(expense.categoryId)
  }

  protected metaOf(expense: ExpenseRecord): string {
    const parts: string[] = []
    if (this.splitMode()) parts.push(this.splitOf(expense))
    if (expense.description) parts.push(this.categoryName(expense.categoryId))
    if (expense.currency !== this.base()) {
      parts.push(
        expense.baseAmountMinor === null
          ? this.transloco.translate('money.expenses.row.waiting')
          : this.money(BigInt(expense.baseAmountMinor), this.base())
      )
    }
    if (expense.needsDetails)
      parts.push(this.transloco.translate('money.expenses.row.needsDetails'))
    if (expense.syncState === 'pending') {
      parts.push(this.transloco.translate('money.expenses.row.pending'))
    }
    return parts.filter(Boolean).join(' · ')
  }

  /** "Paid by X · split N ways"; an expense without shares is split between everyone. */
  private splitOf(expense: ExpenseRecord): string {
    const payer = this.travellerName(expense.paidByTravellerId ?? this.ownerTravellerId())
    const count = this.sharesByExpense().get(expense.id) ?? this.travellers().length
    return this.transloco.translate('money.split.chip', { payer, count })
  }

  /** The expense's split as the split sheet edits it: equal unless the shares say otherwise. */
  private splitDataOf(expense: ExpenseRecord): NonNullable<ExpenseEditData['split']> {
    const travellers = this.travellers().map((row) => ({ id: row.id, name: row.displayName }))
    const order = travellers.map((row) => row.id)
    const stored = this.shares().filter((share) => share.expenseId === expense.id)
    const payerId = expense.paidByTravellerId ?? this.ownerTravellerId() ?? order[0] ?? null
    const participantIds =
      stored.length > 0 ? order.filter((id) => stored.some((s) => s.travellerId === id)) : order
    const equal = splitShares(expense.amountMinor, { payerId, participantIds, custom: null }, order)
    const custom =
      stored.length > 0 &&
      equal.shares.some(
        (share) =>
          stored.find((s) => s.travellerId === share.travellerId)?.shareMinor !== share.shareMinor
      )
        ? Object.fromEntries(stored.map((share) => [share.travellerId, share.shareMinor]))
        : null
    return { travellers, draft: { payerId, participantIds, custom } }
  }

  /** "Mark as settled": the debtor pays the creditor back, through the outbox. */
  protected async markSettled(row: {
    from: string
    to: string
    amountMinor: bigint
  }): Promise<void> {
    const trip = this.trip()
    if (!trip) return
    const other = this.categories().find((category) => category.key === 'other')
    await this.store.settle({
      tripId: trip.id,
      baseCurrency: trip.baseCurrency,
      fromTravellerId: row.from,
      toTravellerId: row.to,
      amountMinor: Number(row.amountMinor),
      categoryId: other?.id ?? null,
      spentOn: this.today(),
      description: this.transloco.translate('money.balances.settleDescription'),
    })
    this.toasts.show({ message: this.transloco.translate('money.toast.settled') })
  }

  protected amountOf(expense: ExpenseRecord): string {
    return this.money(BigInt(expense.amountMinor), expense.currency)
  }

  protected selectView(id: string | undefined): void {
    if (id === 'budget' || id === 'expenses' || id === 'balances') this.view.set(id)
  }

  protected togglePhase(phase: ExpensePhase, on: boolean): void {
    this.phaseFilter.update((set) => toggled(set, phase, on))
  }

  protected toggleCategory(id: string, on: boolean): void {
    this.categoryFilter.update((set) => toggled(set, id, on))
  }

  protected edit(expense: ExpenseRecord): void {
    const data: ExpenseEditData = {
      expense,
      baseCurrency: this.base(),
      categories: this.categoryOptions(),
      events: this.events().map((event) => ({ id: event.id, title: event.title })),
      ...(this.splitMode() ? { split: this.splitDataOf(expense) } : {}),
    }
    const ref = this.sheets.open<ExpenseEditResult, ExpenseEditData>(ExpenseEditSheet, {
      data,
      label: this.transloco.translate('money.edit.title'),
    })
    ref.closed.subscribe((result) => {
      if (result?.outcome === 'deleted') {
        const deleted = result.expense
        this.toasts.showUndo(
          this.transloco.translate('money.toast.deleted'),
          () => void this.store.restore(deleted)
        )
      } else if (result?.outcome === 'saved') {
        this.toasts.show({ message: this.transloco.translate('money.toast.updated') })
      }
    })
  }

  protected editBudget(): void {
    const trip = this.trip()
    if (!trip) return
    const data: BudgetEditData = {
      trip,
      role: this.role(),
      categories: this.categories().map((category) => ({
        id: category.id,
        label: categoryLabel(category, this.categoryWords()),
        budgetMinor: category.budgetMinor,
      })),
    }
    const ref = this.sheets.open<boolean, BudgetEditData>(BudgetEditSheet, {
      data,
      label: this.transloco.translate('money.budgetEdit.title'),
    })
    ref.closed.subscribe((saved) => {
      if (saved) {
        this.toasts.show({ message: this.transloco.translate('money.toast.budgetSaved') })
      }
    })
  }

  private barLabel(bar: BudgetBar): string {
    return bar.categoryId === null
      ? this.words()[9]
      : categoryLabel({ key: bar.key, name: bar.name }, this.categoryWords())
  }

  private categoryName(categoryId: string | null): string {
    const category = this.categories().find((row) => row.id === categoryId)
    return category ? categoryLabel(category, this.categoryWords()) : this.words()[9]
  }

  private travellerName(id: string | null): string {
    return (
      this.travellers().find((row) => row.id === id)?.displayName ??
      this.transloco.translate('money.balances.someone')
    )
  }

  private money(minor: bigint, currency: string): string {
    return formatMoney(minor, currency, this.locale(), { disambiguate: this.mixed() })
  }
}

function toggled<T>(set: ReadonlySet<T>, value: T, on: boolean): ReadonlySet<T> {
  const next = new Set(set)
  if (on) next.add(value)
  else next.delete(value)
  return next
}
