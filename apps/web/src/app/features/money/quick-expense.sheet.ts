import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { TranslocoPipe } from '@jsverse/transloco'
import { minorUnitExponent } from '@monkitrips/shared'
import { LangStore } from '../../core/i18n/lang.store'
import { CLOCK } from '../../core/offline/clock'
import type { BudgetCategoryRecord, ExpenseRecord } from '../../core/offline/records'
import { TIME_ZONE } from '../../core/offline/time-zone'
import {
  tripBudgetCategories,
  tripExpenses,
  tripRecord,
  tripStops,
  tripTravellers,
} from '../../core/offline/trip-queries'
import { SessionStore } from '../../core/session/session.store'
import { KNOWN_CURRENCIES } from '../../domain/currency-for-country'
import { defaultCategoryId, defaultCurrency } from '../../domain/expense-defaults'
import { formatLocaleFor } from '../../domain/locale'
import { formatMoney, keypadToMinor } from '../../domain/money'
import { tripToday } from '../../domain/trip-today'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkChipComponent } from '../../shared/ui/chip/chip.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkKeypadComponent } from '../../shared/ui/keypad/keypad.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { scopedLabels } from '../../core/i18n/scoped-labels'
import { CATEGORY_LABEL_KEYS, categoryLabel } from './category-label'
import { provideMoneyI18n } from './money-i18n'
import { MoneyStore } from './money.store'

export interface QuickExpenseData {
  tripId: string
}

/** The sheet closes with the saved expense, or with nothing when dismissed. */
export type QuickExpenseResult = { expense: ExpenseRecord } | undefined

/**
 * The quick expense in three taps or fewer: the keypad has the focus, the
 * currency is the one of the country the day is spent in, the category
 * the last one used (or the one the time of day suggests); the person
 * types the amount, may tap another category chip, and saves. The details
 * (description, event, rate) come later in the edit sheet: the expense is
 * saved with `needsDetails`. Written to Dexie through the outbox, so it
 * works offline; the rate is attached by the server on sync.
 */
@Component({
  selector: 'app-quick-expense-sheet',
  imports: [
    FormsModule,
    TranslocoPipe,
    MkSheetComponent,
    MkKeypadComponent,
    MkChipComponent,
    MkButtonComponent,
    MkFieldComponent,
    MkInputDirective,
    MkRowComponent,
    MkStackComponent,
    MkTextComponent,
  ],
  providers: [provideMoneyI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'money.quick.title' | transloco">
      @if (trip(); as trip) {
        <mk-stack gap="2">
          <mk-row justify="between" align="end" gap="2">
            <p
              mk-text
              variant="display"
              [attr.aria-label]="'money.quick.amount' | transloco"
              data-testid="money.quick.amount"
            >
              {{ amountText() }}
            </p>
            <mk-field [label]="'money.quick.currency' | transloco">
              <select
                mkInput
                variant="code"
                [ngModel]="currency()"
                (ngModelChange)="chosenCurrency.set($event)"
                data-testid="money.quick.currency"
              >
                @for (code of currencies(); track code) {
                  <option [value]="code">{{ code }}</option>
                }
              </select>
            </mk-field>
          </mk-row>
          <mk-keypad
            [value]="digits()"
            (valueChange)="digits.set($event)"
            [decimals]="decimals()"
            [autofocus]="true"
          />
          @if (categories().length > 0) {
            <mk-row
              gap="1"
              [wrap]="true"
              role="group"
              [attr.aria-label]="'money.quick.category' | transloco"
            >
              @for (category of categories(); track category.id) {
                <mk-chip
                  [selectable]="true"
                  [selected]="category.id === categoryId()"
                  (selectedChange)="chosenCategory.set(category.id)"
                  data-testid="money.quick.category"
                  [attr.data-category-key]="category.key"
                >
                  {{ categoryName(category) }}
                </mk-chip>
              }
            </mk-row>
          }
        </mk-stack>
        <button
          mkSheetFooter
          mk-button
          size="block"
          type="button"
          [disabled]="!amountMinor() || saving()"
          [loading]="saving()"
          data-testid="money.quick.save"
          (click)="save()"
        >
          {{ 'money.quick.save' | transloco }}
        </button>
      } @else {
        <p mk-text tone="ink-2" data-testid="money.quick.noTrip">
          {{ 'money.quick.noTrip' | transloco }}
        </p>
      }
    </mk-sheet>
  `,
})
export class QuickExpenseSheet {
  private readonly data = inject<QuickExpenseData>(DIALOG_DATA)
  private readonly ref = inject<DialogRef<QuickExpenseResult>>(DialogRef)
  private readonly store = inject(MoneyStore)
  private readonly session = inject(SessionStore)
  private readonly lang = inject(LangStore)
  private readonly clock = inject(CLOCK)
  private readonly deviceZone = inject(TIME_ZONE)

  private readonly tripId = signal(this.data.tripId)
  protected readonly trip = tripRecord(this.tripId)
  private readonly stops = tripStops(this.tripId)
  private readonly expenses = tripExpenses(this.tripId)
  private readonly travellers = tripTravellers(this.tripId)
  protected readonly categories = tripBudgetCategories(this.tripId)

  protected readonly digits = signal('')
  protected readonly chosenCurrency = signal<string | null>(null)
  protected readonly chosenCategory = signal<string | null>(null)
  protected readonly saving = signal(false)

  /** The place's today, read when the sheet opens. */
  private readonly today = computed(() => tripToday(this.clock(), this.deviceZone, this.stops()))
  private readonly base = computed(() => this.trip()?.baseCurrency ?? 'EUR')

  protected readonly currency = computed(
    () => this.chosenCurrency() ?? defaultCurrency(this.stops(), this.today().date, this.base())
  )
  protected readonly currencies = computed(() => [
    ...new Set([this.currency(), this.base(), ...KNOWN_CURRENCIES]),
  ])
  protected readonly decimals = computed(() => minorUnitExponent(this.currency()).exponent)
  protected readonly categoryId = computed(() => {
    const chosen = this.chosenCategory()
    if (chosen) return chosen
    const last = [...this.expenses()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    return defaultCategoryId({
      lastUsedId: last?.categoryId ?? null,
      localHour: this.today().hour,
      categories: this.categories(),
    })
  })
  protected readonly amountMinor = computed(() => keypadToMinor(this.digits(), this.currency()))
  protected readonly amountText = computed(() =>
    formatMoney(this.amountMinor() ?? 0, this.currency(), formatLocaleFor(this.lang.lang()))
  )

  private readonly categoryWords = scopedLabels('money', CATEGORY_LABEL_KEYS)

  protected categoryName(category: BudgetCategoryRecord): string {
    return categoryLabel(category, this.categoryWords())
  }

  protected async save(): Promise<void> {
    const trip = this.trip()
    const amountMinor = this.amountMinor()
    if (!trip || !amountMinor || this.saving()) {
      return
    }
    this.saving.set(true)
    try {
      const me = this.session.user()?.id
      const expense = await this.store.addQuick({
        tripId: trip.id,
        baseCurrency: trip.baseCurrency,
        amountMinor,
        currency: this.currency(),
        categoryId: this.categoryId(),
        spentOn: this.today().date,
        paidByTravellerId: this.travellers().find((row) => me && row.userId === me)?.id ?? null,
      })
      this.ref.close({ expense })
    } finally {
      this.saving.set(false)
    }
  }
}
