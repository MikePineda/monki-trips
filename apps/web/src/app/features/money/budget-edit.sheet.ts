import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { minorUnitExponent, type TripMemberRole } from '@monkitrips/shared'
import type { TripRecord } from '../../core/offline/records'
import { canEditTripField } from '../../domain/owner-only-fields'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { provideMoneyI18n } from './money-i18n'
import { MoneyStore } from './money.store'

export interface BudgetEditData {
  trip: TripRecord
  /** The signed-in person's role: owner-only fields are disabled for an editor. */
  role: TripMemberRole
  /** The trip's categories, already labelled, with their budget in base minor units. */
  categories: readonly { id: string; label: string; budgetMinor: number | null }[]
}

/**
 * The trip's budget: the total and one line per category, in the base
 * currency (major units, empty for none). Only changed values are written,
 * each through the outbox. A field the contract keeps for the owner is
 * shown disabled to an editor, with a sentence saying why.
 */
@Component({
  selector: 'app-budget-edit-sheet',
  imports: [
    TranslocoPipe,
    MkSheetComponent,
    MkFieldComponent,
    MkInputDirective,
    MkButtonComponent,
    MkSectionComponent,
    MkStackComponent,
  ],
  providers: [provideMoneyI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'money.budgetEdit.title' | transloco">
      <form novalidate (submit)="save($event)">
        <mk-stack gap="2">
          <mk-field
            [label]="'money.budgetEdit.total' | transloco"
            [hint]="
              totalLocked()
                ? ('money.budgetEdit.ownerOnly' | transloco)
                : ('money.budgetEdit.totalHint' | transloco: { currency: currency })
            "
          >
            <input
              mkInput
              type="number"
              inputmode="decimal"
              min="0"
              [step]="step"
              [value]="total()"
              [disabled]="totalLocked()"
              (input)="total.set($any($event.target).value)"
              data-testid="money.budgetEdit.total"
            />
          </mk-field>
          @if (data.categories.length > 0) {
            <mk-section [eyebrow]="'money.budgetEdit.categories' | transloco">
              <mk-stack gap="1">
                @for (category of data.categories; track category.id; let index = $index) {
                  <mk-field [label]="category.label">
                    <input
                      mkInput
                      type="number"
                      inputmode="decimal"
                      min="0"
                      [step]="step"
                      [value]="lines()[index]"
                      (input)="setLine(index, $any($event.target).value)"
                      data-testid="money.budgetEdit.category"
                      [attr.data-category-id]="category.id"
                    />
                  </mk-field>
                }
              </mk-stack>
            </mk-section>
          }
          <button
            mk-button
            size="block"
            type="submit"
            [loading]="busy()"
            data-testid="money.budgetEdit.save"
          >
            {{ 'money.budgetEdit.save' | transloco }}
          </button>
        </mk-stack>
      </form>
    </mk-sheet>
  `,
})
export class BudgetEditSheet {
  protected readonly data = inject<BudgetEditData>(DIALOG_DATA)
  private readonly store = inject(MoneyStore)
  private readonly ref = inject<DialogRef<boolean>>(DialogRef)

  protected readonly currency = this.data.trip.baseCurrency
  private readonly exponent = minorUnitExponent(this.currency).exponent
  protected readonly step = this.exponent === 0 ? '1' : `0.${'0'.repeat(this.exponent - 1)}1`
  protected readonly busy = signal(false)
  protected readonly totalLocked = computed(
    () => !canEditTripField(this.data.role, 'budgetTotalMinor')
  )
  protected readonly total = signal(this.toMajor(this.data.trip.budgetTotalMinor ?? null))
  protected readonly lines = signal(
    this.data.categories.map((category) => this.toMajor(category.budgetMinor))
  )

  protected setLine(index: number, value: string): void {
    this.lines.update((lines) => lines.map((line, at) => (at === index ? value : line)))
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault()
    this.busy.set(true)
    try {
      const total = this.toMinor(this.total())
      if (
        !this.totalLocked() &&
        total !== undefined &&
        total !== (this.data.trip.budgetTotalMinor ?? null)
      ) {
        await this.store.setTripBudget(this.data.trip.id, total)
      }
      const lines = this.lines()
      for (const [index, category] of this.data.categories.entries()) {
        const budget = this.toMinor(lines[index])
        if (budget !== undefined && budget !== category.budgetMinor) {
          await this.store.setCategoryBudget(category.id, budget)
        }
      }
      this.ref.close(true)
    } finally {
      this.busy.set(false)
    }
  }

  private toMajor(minor: number | null): string {
    return minor === null ? '' : (minor / 10 ** this.exponent).toFixed(this.exponent)
  }

  /** Minor units of a typed amount; null for empty, undefined for something that is not an amount. */
  private toMinor(major: string): number | null | undefined {
    const trimmed = String(major ?? '').trim()
    if (trimmed === '') return null
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined
    return Math.round(Number(trimmed) * 10 ** this.exponent)
  }
}
