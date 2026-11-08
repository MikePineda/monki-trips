import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { TranslocoPipe } from '@jsverse/transloco'
import { LangStore } from '../../core/i18n/lang.store'
import { formatLocaleFor } from '../../domain/locale'
import { formatMoney, keypadToMinor, minorToKeypad } from '../../domain/money'
import { splitShares, type SplitDraft } from '../../domain/split-draft'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkChipComponent } from '../../shared/ui/chip/chip.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkRowComponent } from '../../shared/ui/layout/row.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { MkSwitchComponent } from '../../shared/ui/switch/switch.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { provideMoneyI18n } from './money-i18n'

export interface SplitSheetData {
  amountMinor: number
  currency: string
  /** Every traveller of the trip in position order, people without an account included. */
  travellers: readonly { id: string; name: string }[]
  draft: SplitDraft
}

/**
 * Who paid an expense and who shares it. Equal between the people picked
 * by default; "Custom amounts" opens one field per person, and the line
 * under them says live how much is left to assign. "Done" closes with the
 * draft only when it adds up; dismissing changes nothing.
 */
@Component({
  selector: 'app-split-sheet',
  imports: [
    FormsModule,
    TranslocoPipe,
    MkSheetComponent,
    MkButtonComponent,
    MkChipComponent,
    MkFieldComponent,
    MkInputDirective,
    MkRowComponent,
    MkStackComponent,
    MkSwitchComponent,
    MkTextComponent,
  ],
  providers: [provideMoneyI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'money.split.title' | transloco">
      <mk-stack gap="2">
        <p mk-text variant="eyebrow" tone="ink-2" data-testid="money.split.total">
          {{ 'money.split.total' | transloco: { amount: money(data.amountMinor) } }}
        </p>
        <mk-field [label]="'money.split.paidBy' | transloco">
          <select
            mkInput
            [ngModel]="payerId()"
            (ngModelChange)="payerId.set($event)"
            data-testid="money.split.payer"
          >
            @for (traveller of data.travellers; track traveller.id) {
              <option [value]="traveller.id">{{ traveller.name }}</option>
            }
          </select>
        </mk-field>
        <mk-stack gap="1">
          <p mk-text variant="label" id="split-shared-by">
            {{ 'money.split.sharedBy' | transloco }}
          </p>
          <mk-row gap="1" [wrap]="true" role="group" aria-labelledby="split-shared-by">
            @for (traveller of data.travellers; track traveller.id) {
              <mk-chip
                [selectable]="true"
                [selected]="participants().has(traveller.id)"
                (selectedChange)="toggle(traveller.id, $event)"
                data-testid="money.split.participant"
                [attr.data-traveller-id]="traveller.id"
              >
                {{ traveller.name }}
              </mk-chip>
            }
          </mk-row>
        </mk-stack>
        <mk-switch
          [checked]="custom()"
          (checkedChange)="setCustom($event)"
          testId="money.split.custom"
        >
          {{ 'money.split.custom' | transloco }}
        </mk-switch>
        @if (custom()) {
          @for (traveller of chosen(); track traveller.id) {
            <mk-field [label]="traveller.name">
              <input
                mkInput
                type="text"
                inputmode="decimal"
                autocomplete="off"
                [ngModel]="typed()[traveller.id] ?? ''"
                (ngModelChange)="type(traveller.id, $event)"
                data-testid="money.split.amount"
                [attr.data-traveller-id]="traveller.id"
              />
            </mk-field>
          }
        }
        <p
          mk-text
          [tone]="result().valid ? 'ink-2' : 'status-serious'"
          role="status"
          data-testid="money.split.sum"
        >
          {{ sum().key | transloco: sum().params }}
        </p>
      </mk-stack>
      <button
        mkSheetFooter
        mk-button
        size="block"
        type="button"
        [disabled]="!result().valid"
        data-testid="money.split.done"
        (click)="done()"
      >
        {{ 'money.split.done' | transloco }}
      </button>
    </mk-sheet>
  `,
})
export class SplitSheet {
  protected readonly data = inject<SplitSheetData>(DIALOG_DATA)
  private readonly ref = inject<DialogRef<SplitDraft>>(DialogRef)
  private readonly lang = inject(LangStore)

  private readonly order = this.data.travellers.map((traveller) => traveller.id)
  protected readonly payerId = signal(this.data.draft.payerId ?? this.order[0] ?? '')
  protected readonly participants = signal<ReadonlySet<string>>(
    new Set(this.data.draft.participantIds)
  )
  protected readonly custom = signal(this.data.draft.custom !== null)
  /** What the person typed per traveller, in major units. */
  protected readonly typed = signal<Readonly<Record<string, string>>>(
    Object.fromEntries(
      Object.entries(this.data.draft.custom ?? {}).map(([id, minor]) => [
        id,
        minorToKeypad(minor, this.data.currency),
      ])
    )
  )

  protected readonly chosen = computed(() =>
    this.data.travellers.filter((traveller) => this.participants().has(traveller.id))
  )
  private readonly draft = computed<SplitDraft>(() => ({
    payerId: this.payerId(),
    participantIds: this.order.filter((id) => this.participants().has(id)),
    custom: this.custom()
      ? Object.fromEntries(
          this.chosen().map((traveller) => [
            traveller.id,
            keypadToMinor(this.typed()[traveller.id] ?? '', this.data.currency) ?? 0,
          ])
        )
      : null,
  }))
  protected readonly result = computed(() =>
    splitShares(this.data.amountMinor, this.draft(), this.order)
  )
  /** The live line under the split: what is left, what is too much, or that it adds up. */
  protected readonly sum = computed(() => {
    const result = this.result()
    if (this.chosen().length === 0) return { key: 'money.split.nobody', params: {} }
    if (result.remainingMinor > 0) {
      return { key: 'money.split.left', params: { amount: this.money(result.remainingMinor) } }
    }
    if (result.remainingMinor < 0) {
      return { key: 'money.split.over', params: { amount: this.money(-result.remainingMinor) } }
    }
    return { key: 'money.split.addsUp', params: { amount: this.money(this.data.amountMinor) } }
  })

  protected money(minor: number): string {
    return formatMoney(minor, this.data.currency, formatLocaleFor(this.lang.lang()))
  }

  protected toggle(id: string, on: boolean): void {
    this.participants.update((set) => {
      const next = new Set(set)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  /** Custom amounts start from the equal split, so only the differences need typing. */
  protected setCustom(on: boolean): void {
    if (on) {
      const equal = splitShares(
        this.data.amountMinor,
        { ...this.draft(), custom: null },
        this.order
      )
      this.typed.set(
        Object.fromEntries(
          equal.shares.map((share) => [
            share.travellerId,
            minorToKeypad(share.shareMinor, this.data.currency),
          ])
        )
      )
    }
    this.custom.set(on)
  }

  protected type(id: string, value: string): void {
    this.typed.update((typed) => ({ ...typed, [id]: value }))
  }

  protected done(): void {
    if (this.result().valid) {
      this.ref.close(this.draft())
    }
  }
}
