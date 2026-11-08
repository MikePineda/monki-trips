import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import {
  minorUnitExponent,
  type ExtractionReviewFlag,
  type ExtractionReviewReason,
} from '@monkitrips/shared'
import { ApiFailure, toApiFailure } from '../../core/api/api-failure'
import { LangStore } from '../../core/i18n/lang.store'
import { CLOCK } from '../../core/offline/clock'
import { OnlineStore } from '../../core/offline/online.store'
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
import { defaultSplit, sharesFor, type SplitDraft } from '../../domain/split-draft'
import { tripToday } from '../../domain/trip-today'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkChipComponent, type ChipTone } from '../../shared/ui/chip/chip.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import type { IconName } from '../../shared/ui/icon/icon-names'
import { MkKeypadComponent } from '../../shared/ui/keypad/keypad.component'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { scopedLabels } from '../../core/i18n/scoped-labels'
import { CATEGORY_LABEL_KEYS, categoryLabel } from './category-label'
import { provideMoneyI18n } from './money-i18n'
import { MoneyStore } from './money.store'
import { SplitSheet, type SplitSheetData } from './split.sheet'
import { RECEIPT_DOWNSCALER } from './receipt-downscaler'
import { RECEIPT_EXTRACTION_API } from './receipt-extraction-api'
import { receiptFill } from './receipt-fill'

/** Receipt fields the sheet can flag; others the server may name are not shown here. */
const RECEIPT_FIELDS = ['amount', 'currency', 'spentOn', 'categoryKey', 'merchant'] as const

/** Codes the `money.errors` catalogue explains for a receipt scan; anything else is `unknown`. */
const RECEIPT_ERROR_CODES = [
  'E_EXTRACTION_UNAVAILABLE',
  'E_LLM_UNAVAILABLE',
  'E_LLM_QUOTA_EXCEEDED',
  'E_TOO_MANY_REQUESTS',
  'E_LLM_BAD_OUTPUT',
  'E_UNSUPPORTED_FILE',
  'E_FILE_TOO_LARGE',
] as const

/** Icon and tone of each review reason; the reason's word always goes next to them. */
const FLAG_LOOK: Record<ExtractionReviewReason, { icon: IconName; tone: ChipTone }> = {
  needs_review: { icon: 'alert-triangle', tone: 'warning' },
  low_confidence: { icon: 'circle-alert', tone: 'warning' },
  missing: { icon: 'circle-x', tone: 'serious' },
}

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
 * works offline; the rate is attached by the server on sync. In split
 * mode the expense is paid by me and shared equally by everyone unless
 * the split chip says otherwise, so the three taps stay three.
 *
 * "Scan receipt" is a secondary way in, online only, that never changes
 * the three taps: the photo is downscaled on the device (EXIF dropped),
 * read by the AI provider and not stored; what it says fills the amount,
 * currency, date and category for the member to confirm, the fields to
 * check flagged with an icon and a word, and Save writes the same outbox
 * expense as ever.
 */
@Component({
  selector: 'app-quick-expense-sheet',
  imports: [
    FormsModule,
    TranslocoPipe,
    MkSheetComponent,
    MkApiErrorComponent,
    MkKeypadComponent,
    MkChipComponent,
    MkEmptyStateComponent,
    MkIconComponent,
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
          @if (splitMode()) {
            <mk-row gap="1" [wrap]="true">
              <mk-chip
                [selectable]="true"
                [selected]="splitOpen()"
                (selectedChange)="openSplit()"
                icon="users"
                [attr.aria-label]="'money.split.open' | transloco"
                data-testid="money.quick.split"
              >
                {{ splitLabel().key | transloco: splitLabel().params }}
              </mk-chip>
            </mk-row>
          }
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

          @if (scanned()) {
            <mk-stack gap="1" data-testid="money.quick.scanned">
              <p mk-text tone="ink-2">{{ 'money.scan.confirm' | transloco }}</p>
              @if (merchant(); as merchant) {
                <p mk-text variant="caption" tone="ink-2" data-testid="money.quick.merchant">
                  {{ 'money.scan.from' | transloco: { merchant } }}
                </p>
              }
              <mk-field [label]="'money.scan.date' | transloco">
                <input
                  mkInput
                  type="date"
                  [value]="spentOn()"
                  data-testid="money.quick.date"
                  (change)="pickDate($event)"
                />
              </mk-field>
              @if (scanFlags().length > 0) {
                <mk-row gap="1" [wrap]="true" data-testid="money.quick.flags">
                  @for (flag of scanFlags(); track flag.field) {
                    <mk-chip
                      variant="status"
                      [tone]="look[flag.reason].tone"
                      [icon]="look[flag.reason].icon"
                      [attr.data-testid]="'money.quick.flag.' + flag.field"
                      [attr.data-reason]="flag.reason"
                    >
                      {{
                        'money.scan.flagged'
                          | transloco
                            : {
                                field: 'money.scan.field.' + flag.field | transloco,
                                reason: 'money.scan.flag.' + flag.reason | transloco,
                              }
                      }}
                    </mk-chip>
                  }
                </mk-row>
              }
            </mk-stack>
          }

          @if (scanning()) {
            <mk-empty-state
              mascot="thinking"
              [title]="'money.scan.reading' | transloco"
              data-testid="money.quick.scanning"
            />
          }
          <mk-stack gap="half">
            <mk-row>
              <button
                mk-button
                variant="secondary"
                size="sm"
                type="button"
                [disabled]="!online() || scanning()"
                data-testid="money.quick.scan"
                (click)="receiptInput.click()"
              >
                <mk-icon name="image" [size]="18" />
                {{ 'money.scan.action' | transloco }}
              </button>
            </mk-row>
            <input
              #receiptInput
              mkInput
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              data-testid="money.quick.scanFile"
              (change)="scan($event)"
            />
            @if (!online()) {
              <p mk-text variant="caption" tone="ink-2" data-testid="money.quick.scanOffline">
                {{ 'money.scan.offline' | transloco }}
              </p>
            }
            <p mk-text variant="caption" tone="ink-3" data-testid="money.quick.scanPrivacy">
              {{ 'money.scan.privacy' | transloco }}
            </p>
            <mk-api-error
              [failure]="scanFailure()"
              scope="money"
              [knownCodes]="scanErrorCodes"
              testId="money.quick.scanError"
            />
          </mk-stack>
        </mk-stack>
      } @else {
        <p mk-text tone="ink-2" data-testid="money.quick.noTrip">
          {{ 'money.quick.noTrip' | transloco }}
        </p>
      }
      <!-- Its own block with one root node, so it projects into the sheet footer. -->
      @if (trip()) {
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
  private readonly sheets = inject(SheetService)
  private readonly transloco = inject(TranslocoService)
  private readonly receipts = inject(RECEIPT_EXTRACTION_API)
  private readonly downscale = inject(RECEIPT_DOWNSCALER)
  protected readonly online = inject(OnlineStore).online
  protected readonly look = FLAG_LOOK
  protected readonly scanErrorCodes = RECEIPT_ERROR_CODES

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
  protected readonly chosenSplit = signal<SplitDraft | null>(null)
  protected readonly splitOpen = signal(false)
  protected readonly chosenDate = signal<string | null>(null)
  protected readonly scanning = signal(false)
  protected readonly scanned = signal(false)
  protected readonly scanFailure = signal<ApiFailure | null>(null)
  protected readonly scanFlags = signal<ExtractionReviewFlag[]>([])
  protected readonly merchant = signal<string | null>(null)

  /** The place's today, read when the sheet opens. */
  private readonly today = computed(() => tripToday(this.clock(), this.deviceZone, this.stops()))
  /** The day the expense is booked on: the receipt's when one was read, else the place's today. */
  protected readonly spentOn = computed(() => this.chosenDate() ?? this.today().date)
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
    const last = this.expenses()
      .filter((expense) => expense.kind !== 'settlement')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
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

  protected readonly splitMode = computed(
    () => this.trip()?.budgetMode === 'split' && this.travellers().length > 0
  )
  private readonly travellerIds = computed(() => this.travellers().map((row) => row.id))
  private readonly meId = computed(() => {
    const me = this.session.user()?.id
    return this.travellers().find((row) => me && row.userId === me)?.id ?? null
  })
  private readonly split = computed(
    () => this.chosenSplit() ?? defaultSplit(this.travellerIds(), this.meId())
  )
  /** The shares to save; custom amounts made for another amount follow it in proportion. */
  private readonly shares = computed(() =>
    sharesFor(this.amountMinor() ?? 0, this.split(), this.travellerIds())
  )
  protected readonly splitLabel = computed(() => {
    const draft = this.split()
    const name = (id: string | null) =>
      this.travellers().find((row) => row.id === id)?.displayName ?? ''
    const count = draft.participantIds.length
    return count === 1
      ? {
          key: 'money.split.chipOne',
          params: { payer: name(draft.payerId), name: name(draft.participantIds[0] ?? null) },
        }
      : { key: 'money.split.chip', params: { payer: name(draft.payerId), count } }
  })

  private readonly categoryWords = scopedLabels('money', CATEGORY_LABEL_KEYS)

  protected categoryName(category: BudgetCategoryRecord): string {
    return categoryLabel(category, this.categoryWords())
  }

  protected openSplit(): void {
    this.splitOpen.set(true)
    const data: SplitSheetData = {
      amountMinor: this.amountMinor() ?? 0,
      currency: this.currency(),
      travellers: this.travellers().map((row) => ({ id: row.id, name: row.displayName })),
      draft: this.split(),
    }
    const ref = this.sheets.open<SplitDraft, SplitSheetData>(SplitSheet, {
      data,
      label: this.transloco.translate('money.split.title'),
    })
    ref.closed.subscribe((draft) => {
      this.splitOpen.set(false)
      if (draft) this.chosenSplit.set(draft)
    })
  }

  protected async save(): Promise<void> {
    const trip = this.trip()
    const amountMinor = this.amountMinor()
    if (!trip || !amountMinor || this.saving()) {
      return
    }
    this.saving.set(true)
    try {
      const split = this.splitMode()
      const expense = await this.store.addQuick({
        tripId: trip.id,
        baseCurrency: trip.baseCurrency,
        amountMinor,
        currency: this.currency(),
        categoryId: this.categoryId(),
        spentOn: this.spentOn(),
        paidByTravellerId: split ? this.split().payerId : this.meId(),
        shares: split ? this.shares() : null,
      })
      this.ref.close({ expense })
    } finally {
      this.saving.set(false)
    }
  }

  protected pickDate(event: Event): void {
    this.chosenDate.set((event.target as HTMLInputElement).value || null)
  }

  /** Downscales the photo, has it read and fills the sheet for confirmation; online only. */
  protected async scan(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const photo = input.files?.[0] ?? null
    input.value = ''
    const trip = this.trip()
    if (!photo || !trip || !this.online() || this.scanning()) {
      return
    }
    this.scanning.set(true)
    this.scanFailure.set(null)
    try {
      let jpeg: Blob
      try {
        jpeg = await this.downscale(photo)
      } catch {
        throw new ApiFailure({
          kind: 'http',
          status: 415,
          code: 'E_UNSUPPORTED_FILE',
          message: 'The photo could not be decoded',
        })
      }
      const draft = await this.receipts.extract(trip.id, jpeg)
      const fill = receiptFill(draft, this.categories(), this.currency())
      if (fill.currency) this.chosenCurrency.set(fill.currency)
      if (fill.digits !== null) this.digits.set(fill.digits)
      if (fill.spentOn) this.chosenDate.set(fill.spentOn)
      if (fill.categoryId) this.chosenCategory.set(fill.categoryId)
      const flags = draft.review.filter((flag) =>
        (RECEIPT_FIELDS as readonly string[]).includes(flag.field)
      )
      if (fill.digits === null && !flags.some((flag) => flag.field === 'amount')) {
        flags.push({ field: 'amount', reason: draft.amount === null ? 'missing' : 'needs_review' })
      }
      this.scanFlags.set(flags)
      this.merchant.set(draft.merchant)
      this.scanned.set(true)
    } catch (error) {
      this.scanFailure.set(toApiFailure(error))
    } finally {
      this.scanning.set(false)
    }
  }
}
