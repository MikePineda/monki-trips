import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { budgetStatus, type BudgetStatus } from '@monkitrips/shared'
import { scopedLabels } from '../../core/i18n/scoped-labels'
import { LangStore } from '../../core/i18n/lang.store'
import { CLOCK } from '../../core/offline/clock'
import type { ExpenseRecord } from '../../core/offline/records'
import { SyncService } from '../../core/offline/sync.service'
import { TIME_ZONE } from '../../core/offline/time-zone'
import {
  tripBudgetCategories,
  tripEvents,
  tripExpenses,
  tripMembers,
  tripRecord,
  tripStops,
} from '../../core/offline/trip-queries'
import { SessionStore } from '../../core/session/session.store'
import { budgetBars, type BudgetBar } from '../../domain/budget-bars'
import { countKey } from '../../domain/count-key'
import { formatDayDate } from '../../domain/day-date'
import { EXPENSE_PHASES, groupExpensesByDay, type ExpensePhase } from '../../domain/expense-groups'
import { formatLocaleFor } from '../../domain/locale'
import { formatMoney, mixesCurrencies } from '../../domain/money'
import { tripRole } from '../../domain/trip-role'
import { tripToday } from '../../domain/trip-today'
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

type MoneyView = 'budget' | 'expenses'
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
 * summed, exactly as the shared domain does.
 */
@Component({
  selector: 'app-money-page',
  imports: [
    TranslocoPipe,
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
        [(value)]="view"
        [label]="'money.views.label' | transloco"
        testId="money.view"
      />

      @if (view() === 'budget') {
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
  protected readonly expenses = tripExpenses(this.tripId)
  private readonly categories = tripBudgetCategories(this.tripId)
  private readonly stops = tripStops(this.tripId)
  private readonly events = tripEvents(this.tripId)
  private readonly members = tripMembers(this.tripId)

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

  protected readonly views = computed(() => [
    { id: 'budget', label: this.words()[0] },
    { id: 'expenses', label: this.words()[1] },
  ])
  protected readonly budgetViews = computed(() => [
    { id: 'chart', label: this.words()[2] },
    { id: 'table', label: this.words()[3] },
  ])

  /** The budget per category, with labels: one source for the chart and the table. */
  protected readonly bars = computed(() =>
    budgetBars(this.categories(), this.expenses()).map((bar) => ({
      ...bar,
      label: this.barLabel(bar),
    }))
  )

  protected readonly chartBars = computed<ChartBar[]>(() => {
    const [, , , , , , , , , noBudget, over] = this.words()
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
      { id: 'category', label: words[4] },
      { id: 'spent', label: words[5], align: 'end' },
      { id: 'budget', label: words[6], align: 'end' },
      { id: 'left', label: words[7], align: 'end' },
    ]
  })

  protected readonly tableRows = computed<TableRow[]>(() => {
    const noBudget = this.words()[9]
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

  protected amountOf(expense: ExpenseRecord): string {
    return this.money(BigInt(expense.amountMinor), expense.currency)
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
      ? this.words()[8]
      : categoryLabel({ key: bar.key, name: bar.name }, this.categoryWords())
  }

  private categoryName(categoryId: string | null): string {
    const category = this.categories().find((row) => row.id === categoryId)
    return category ? categoryLabel(category, this.categoryWords()) : this.words()[8]
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
