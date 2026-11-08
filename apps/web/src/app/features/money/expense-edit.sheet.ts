import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { FormField, form, maxLength, pattern, required, submit } from '@angular/forms/signals'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { minorUnitExponent } from '@monkitrips/shared'
import { fieldError } from '../../core/forms/field-error'
import { LangStore } from '../../core/i18n/lang.store'
import type { ExpenseRecord } from '../../core/offline/records'
import { KNOWN_CURRENCIES } from '../../domain/currency-for-country'
import { formatDayDate } from '../../domain/day-date'
import { formatLocaleFor } from '../../domain/locale'
import { formatMoney, keypadToMinor, minorToKeypad } from '../../domain/money'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkKeypadComponent } from '../../shared/ui/keypad/keypad.component'
import { MkRowComponent, MkRowGrowDirective } from '../../shared/ui/layout/row.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { provideMoneyI18n } from './money-i18n'
import { splitShares, type SplitDraft } from '../../domain/split-draft'
import { MkChipComponent } from '../../shared/ui/chip/chip.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { SplitSheet, type SplitSheetData } from './split.sheet'
import {
  MoneyStore,
  type ExpenseChanges,
  type RemovedExpense,
  type SplitChoice,
} from './money.store'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
/** A positive decimal with at most 10 decimals, as `fx_rate numeric(24,10)` stores it. */
const RATE = /^\s*$|^\d{1,14}(\.\d{1,10})?$/

export interface ExpenseEditData {
  expense: ExpenseRecord
  baseCurrency: string
  /** The trip's categories, already labelled. */
  categories: readonly { id: string; label: string }[]
  /** Events an expense may be linked to (id and title). */
  events: readonly { id: string; title: string }[]
  /** Split mode: the travellers and the expense's split as it stands; absent in shared mode. */
  split?: { travellers: readonly { id: string; name: string }[]; draft: SplitDraft }
}

export type ExpenseEditResult =
  { outcome: 'saved' } | { outcome: 'deleted'; expense: RemovedExpense }

interface ExpenseEditModel {
  currency: string
  rate: string
  spentOn: string
  description: string
  categoryId: string
  eventId: string
}

/**
 * Every field of an expense: the amount on the keypad (amounts are never
 * typed in a text field), currency, a rate override with the stored rate
 * shown, date, description, category, the event it paid for, and a place
 * for the receipt (a later package). Saving marks the details as given;
 * "Delete expense" closes with the row so the list offers undo.
 */
@Component({
  selector: 'app-expense-edit-sheet',
  imports: [
    TranslocoPipe,
    FormField,
    MkSheetComponent,
    MkFieldComponent,
    MkInputDirective,
    MkKeypadComponent,
    MkButtonComponent,
    MkChipComponent,
    MkRowComponent,
    MkRowGrowDirective,
    MkStackComponent,
    MkTextComponent,
  ],
  providers: [provideMoneyI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'money.edit.title' | transloco">
      <form novalidate (submit)="save($event)">
        <mk-stack gap="2">
          <mk-stack gap="1">
            <p
              mk-text
              variant="display"
              [attr.aria-label]="'money.edit.amount' | transloco"
              data-testid="money.edit.amount"
            >
              {{ amountText() }}
            </p>
            <mk-keypad
              [value]="digits()"
              (valueChange)="digits.set($event)"
              [decimals]="decimals()"
            />
          </mk-stack>
          <mk-row gap="2" align="start">
            <mk-field mkRowGrow [label]="'money.edit.currency' | transloco">
              <select
                mkInput
                variant="code"
                [formField]="form.currency"
                data-testid="money.edit.currency"
              >
                @for (code of currencies; track code) {
                  <option [value]="code">{{ code }}</option>
                }
              </select>
            </mk-field>
            <mk-field
              mkRowGrow
              [label]="'money.edit.date' | transloco"
              [required]="true"
              [error]="fieldError(form.spentOn)"
            >
              <input mkInput type="date" [formField]="form.spentOn" data-testid="money.edit.date" />
            </mk-field>
          </mk-row>
          @if (!isBase()) {
            <mk-field
              [label]="'money.edit.rate' | transloco"
              [hint]="
                rateParams()
                  ? ('money.edit.rateStored' | transloco: rateParams()!)
                  : ('money.edit.rateWaiting' | transloco)
              "
              [error]="fieldError(form.rate)"
            >
              <input
                mkInput
                variant="code"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                [formField]="form.rate"
                data-testid="money.edit.rate"
              />
            </mk-field>
          } @else {
            <p mk-text variant="caption" tone="ink-3" data-testid="money.edit.rateBase">
              {{ 'money.edit.rateBase' | transloco }}
            </p>
          }
          @if (data.split) {
            <mk-stack gap="half">
              <p mk-text variant="label">{{ 'money.edit.split' | transloco }}</p>
              <mk-row gap="1" [wrap]="true">
                <mk-chip
                  [selectable]="true"
                  [selected]="splitOpen()"
                  (selectedChange)="openSplit()"
                  icon="users"
                  [attr.aria-label]="'money.split.open' | transloco"
                  data-testid="money.edit.split"
                >
                  {{ splitLabel().key | transloco: splitLabel().params }}
                </mk-chip>
              </mk-row>
            </mk-stack>
          }
          <mk-field
            [label]="'money.edit.description' | transloco"
            [error]="fieldError(form.description)"
          >
            <input
              mkInput
              type="text"
              autocomplete="off"
              [formField]="form.description"
              data-testid="money.edit.description"
            />
          </mk-field>
          <mk-row gap="2" align="start" [wrap]="true">
            <mk-field mkRowGrow [label]="'money.edit.category' | transloco">
              <select mkInput [formField]="form.categoryId" data-testid="money.edit.category">
                <option value="">{{ 'money.edit.noCategory' | transloco }}</option>
                @for (category of data.categories; track category.id) {
                  <option [value]="category.id">{{ category.label }}</option>
                }
              </select>
            </mk-field>
            @if (data.events.length > 0) {
              <mk-field mkRowGrow [label]="'money.edit.event' | transloco">
                <select mkInput [formField]="form.eventId" data-testid="money.edit.event">
                  <option value="">{{ 'money.edit.noEvent' | transloco }}</option>
                  @for (event of data.events; track event.id) {
                    <option [value]="event.id">{{ event.title }}</option>
                  }
                </select>
              </mk-field>
            }
          </mk-row>
          <mk-stack gap="half">
            <p mk-text variant="label">{{ 'money.edit.receipt' | transloco }}</p>
            <p mk-text variant="caption" tone="ink-3" data-testid="money.edit.receipt">
              {{ 'money.edit.receiptSoon' | transloco }}
            </p>
          </mk-stack>
          <button
            mk-button
            variant="destructive"
            size="md"
            type="button"
            [disabled]="busy()"
            data-testid="money.edit.delete"
            (click)="remove()"
          >
            {{ 'money.edit.delete' | transloco }}
          </button>
          <button
            mk-button
            size="block"
            type="submit"
            [disabled]="!amountMinor()"
            [loading]="busy()"
            data-testid="money.edit.save"
          >
            {{ 'money.edit.save' | transloco }}
          </button>
        </mk-stack>
      </form>
    </mk-sheet>
  `,
})
export class ExpenseEditSheet {
  protected readonly data = inject<ExpenseEditData>(DIALOG_DATA)
  private readonly store = inject(MoneyStore)
  private readonly lang = inject(LangStore)
  private readonly ref = inject<DialogRef<ExpenseEditResult>>(DialogRef)
  private readonly sheets = inject(SheetService)
  private readonly transloco = inject(TranslocoService)

  protected readonly fieldError = fieldError
  protected readonly busy = signal(false)
  protected readonly splitOpen = signal(false)
  /** The split the person picked in this sheet; null keeps the stored one. */
  private readonly chosenSplit = signal<SplitDraft | null>(null)
  protected readonly currencies = [
    ...new Set([this.data.expense.currency, this.data.baseCurrency, ...KNOWN_CURRENCIES]),
  ]
  /** The rate as stored, kept out of the field so "no change" sends nothing. */
  private readonly storedRate =
    this.data.expense.fxSource === 'manual' ? (this.data.expense.fxRate ?? '') : ''

  protected readonly digits = signal(
    minorToKeypad(this.data.expense.amountMinor, this.data.expense.currency)
  )
  protected readonly model = signal<ExpenseEditModel>({
    currency: this.data.expense.currency,
    rate: this.storedRate,
    spentOn: this.data.expense.spentOn,
    description: this.data.expense.description ?? '',
    categoryId: this.data.expense.categoryId ?? '',
    eventId: this.data.expense.eventId ?? '',
  })
  protected readonly form = form(this.model, (path) => {
    required(path.spentOn)
    pattern(path.spentOn, ISO_DATE)
    pattern(path.rate, RATE)
    maxLength(path.description, 200)
  })

  private readonly currency = computed(() => this.model().currency)
  protected readonly isBase = computed(() => this.currency() === this.data.baseCurrency)
  protected readonly decimals = computed(() => minorUnitExponent(this.currency()).exponent)
  protected readonly amountMinor = computed(() => keypadToMinor(this.digits(), this.currency()))
  private readonly locale = computed(() => formatLocaleFor(this.lang.lang()))
  protected readonly amountText = computed(() =>
    formatMoney(this.amountMinor() ?? 0, this.currency(), this.locale())
  )

  /** The stored rate to show next to the field, null while the server has not attached one. */
  protected readonly rateParams = computed(() => {
    const expense = this.data.expense
    if (!expense.fxRate || expense.fxSource === 'identity' || !expense.fxRateDate) {
      return null
    }
    return {
      rate: expense.fxRate,
      currency: expense.currency,
      base: this.data.baseCurrency,
      date: formatDayDate(expense.fxRateDate, this.locale(), false),
    }
  })

  private readonly split = computed(() => this.chosenSplit() ?? this.data.split?.draft ?? null)
  protected readonly splitLabel = computed(() => {
    const draft = this.split()
    const travellers = this.data.split?.travellers ?? []
    const name = (id: string | null) => travellers.find((row) => row.id === id)?.name ?? ''
    const count = draft?.participantIds.length ?? 0
    return count === 1
      ? {
          key: 'money.split.chipOne',
          params: { payer: name(draft!.payerId), name: name(draft!.participantIds[0] ?? null) },
        }
      : { key: 'money.split.chip', params: { payer: name(draft?.payerId ?? null), count } }
  })
  /** The amount as the expense stores it: a refund stays negative. */
  private readonly signedAmount = computed(
    () => (this.data.expense.amountMinor < 0 ? -1 : 1) * (this.amountMinor() ?? 0)
  )

  protected openSplit(): void {
    const split = this.data.split
    const draft = this.split()
    if (!split || !draft) return
    this.splitOpen.set(true)
    const ref = this.sheets.open<SplitDraft, SplitSheetData>(SplitSheet, {
      data: {
        amountMinor: this.signedAmount(),
        currency: this.currency(),
        travellers: split.travellers,
        draft,
      },
      label: this.transloco.translate('money.split.title'),
    })
    ref.closed.subscribe((picked) => {
      this.splitOpen.set(false)
      if (picked) this.chosenSplit.set(picked)
    })
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault()
    const amountMinor = this.amountMinor()
    if (!amountMinor) {
      return
    }
    await submit(this.form, async () => {
      this.busy.set(true)
      try {
        const value = this.model()
        const expense = this.data.expense
        const sign = expense.amountMinor < 0 ? -1 : 1
        const changes: ExpenseChanges = {}
        if (sign * amountMinor !== expense.amountMinor) changes.amountMinor = sign * amountMinor
        if (value.currency !== expense.currency) changes.currency = value.currency
        if (value.spentOn !== expense.spentOn) changes.spentOn = value.spentOn
        const description = value.description.trim() || null
        if (description !== expense.description) changes.description = description
        const categoryId = value.categoryId || null
        if (categoryId !== expense.categoryId) changes.categoryId = categoryId
        const eventId = value.eventId || null
        if (eventId !== expense.eventId) changes.eventId = eventId
        const rate = value.rate.trim()
        if (!this.isBase() && rate !== this.storedRate) changes.fxRate = rate || null
        await this.store.update(expense.id, changes, this.data.baseCurrency, this.pickedSplit())
        this.ref.close({ outcome: 'saved' })
      } finally {
        this.busy.set(false)
      }
      return undefined
    })
  }

  /** The split to save: only one picked here; custom amounts that no longer add up split equally. */
  private pickedSplit(): SplitChoice | undefined {
    const draft = this.chosenSplit()
    const order = this.data.split?.travellers.map((row) => row.id) ?? []
    if (!draft || !draft.payerId) return undefined
    const result = splitShares(this.signedAmount(), draft, order)
    const shares = result.valid
      ? result.shares
      : splitShares(this.signedAmount(), { ...draft, custom: null }, order).shares
    return { paidByTravellerId: draft.payerId, shares }
  }

  protected async remove(): Promise<void> {
    this.busy.set(true)
    try {
      const expense = await this.store.remove(this.data.expense.id)
      this.ref.close({ outcome: 'deleted', expense })
    } finally {
      this.busy.set(false)
    }
  }
}
