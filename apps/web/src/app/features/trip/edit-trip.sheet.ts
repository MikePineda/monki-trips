import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import {
  disabled,
  form,
  FormField,
  maxLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import {
  BUDGET_MODES,
  minorUnitExponent,
  type BudgetMode,
  type TripMemberRole,
} from '@monkitrips/shared'
import { fieldError } from '../../core/forms/field-error'
import type { TripRecord } from '../../core/offline/records'
import { TripContentStore } from '../../core/offline/trip-content.store'
import { zoneOptions } from '../../domain/zoned-time'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkRowComponent, MkRowGrowDirective } from '../../shared/ui/layout/row.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { provideTripI18n } from './trip-i18n'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CURRENCY = /^[A-Za-z]{3}$/

export interface EditTripData {
  trip: TripRecord
  /** The signed-in person's role: owner-only fields are disabled for an editor. */
  role: TripMemberRole
}

interface EditTripModel {
  name: string
  startsOn: string
  endsOn: string
  baseCurrency: string
  budgetMode: BudgetMode
  /** Major units as typed; empty for no budget. */
  budgetTotal: string
  homeTz: string
}

/**
 * The trip's own fields in a bottom sheet. Saving writes the changed
 * fields to the device and queues one `trip` mutation; the base currency
 * belongs to the owner (and is locked once expenses exist), so an editor
 * sees it disabled instead of a server refusal.
 */
@Component({
  selector: 'app-edit-trip-sheet',
  imports: [
    TranslocoPipe,
    FormField,
    MkSheetComponent,
    MkFieldComponent,
    MkButtonComponent,
    MkInputDirective,
    MkStackComponent,
    MkRowComponent,
    MkRowGrowDirective,
  ],
  providers: [provideTripI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'trip.edit.title' | transloco">
      <form novalidate (submit)="save($event)">
        <mk-stack gap="2">
          <mk-field
            [label]="'trip.edit.name' | transloco"
            [required]="true"
            [error]="fieldError(form.name)"
          >
            <input mkInput type="text" [formField]="form.name" data-testid="trip.edit.name" />
          </mk-field>
          <mk-row gap="2" align="start">
            <mk-field
              mkRowGrow
              [label]="'trip.edit.startsOn' | transloco"
              [required]="true"
              [error]="fieldError(form.startsOn)"
            >
              <input
                mkInput
                type="date"
                [formField]="form.startsOn"
                data-testid="trip.edit.startsOn"
              />
            </mk-field>
            <mk-field
              mkRowGrow
              [label]="'trip.edit.endsOn' | transloco"
              [required]="true"
              [error]="fieldError(form.endsOn)"
            >
              <input mkInput type="date" [formField]="form.endsOn" data-testid="trip.edit.endsOn" />
            </mk-field>
          </mk-row>
          <mk-row gap="2" align="start">
            <mk-field
              mkRowGrow
              [label]="'trip.edit.baseCurrency' | transloco"
              [hint]="
                (ownerOnly() ? 'trip.edit.ownerOnly' : 'trip.edit.baseCurrencyHint') | transloco
              "
              [required]="true"
              [error]="fieldError(form.baseCurrency)"
            >
              <input
                mkInput
                variant="code"
                type="text"
                autocapitalize="characters"
                [formField]="form.baseCurrency"
                data-testid="trip.edit.baseCurrency"
              />
            </mk-field>
            <mk-field mkRowGrow [label]="'trip.edit.budgetMode' | transloco" [required]="true">
              <select mkInput [formField]="form.budgetMode" data-testid="trip.edit.budgetMode">
                @for (mode of budgetModes; track mode) {
                  <option [value]="mode">{{ 'trip.edit.budget.' + mode | transloco }}</option>
                }
              </select>
            </mk-field>
          </mk-row>
          <mk-field
            [label]="'trip.edit.budgetTotal' | transloco"
            [hint]="'trip.edit.budgetTotalHint' | transloco: { currency: currency() }"
            [error]="fieldError(form.budgetTotal)"
          >
            <input
              mkInput
              type="number"
              inputmode="decimal"
              [formField]="form.budgetTotal"
              data-testid="trip.edit.budgetTotal"
            />
          </mk-field>
          <mk-field [label]="'trip.edit.homeTz' | transloco" [required]="true">
            <select mkInput [formField]="form.homeTz" data-testid="trip.edit.homeTz">
              @for (zone of zones; track zone) {
                <option [value]="zone">{{ zone }}</option>
              }
            </select>
          </mk-field>
          <button mk-button size="block" type="submit" data-testid="trip.edit.submit">
            {{ 'trip.edit.save' | transloco }}
          </button>
        </mk-stack>
      </form>
    </mk-sheet>
  `,
})
export class EditTripSheet {
  private readonly data = inject<EditTripData>(DIALOG_DATA)
  private readonly ref = inject<DialogRef<void>>(DialogRef)
  private readonly content = inject(TripContentStore)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)

  protected readonly budgetModes = BUDGET_MODES
  protected readonly fieldError = fieldError
  protected readonly zones = zoneOptions(this.data.trip.homeTz)
  protected readonly ownerOnly = computed(() => this.data.role !== 'owner')

  protected readonly model = signal<EditTripModel>({
    name: this.data.trip.name,
    startsOn: this.data.trip.startDate,
    endsOn: this.data.trip.endDate,
    baseCurrency: this.data.trip.baseCurrency,
    budgetMode: (this.data.trip.budgetMode as BudgetMode | undefined) ?? 'shared',
    budgetTotal: toMajor(this.data.trip.budgetTotalMinor ?? null, this.data.trip.baseCurrency),
    homeTz: this.data.trip.homeTz ?? 'UTC',
  })
  protected readonly currency = computed(() => this.model().baseCurrency.toUpperCase())
  protected readonly form = form(this.model, (path) => {
    required(path.name)
    maxLength(path.name, 120)
    required(path.startsOn)
    pattern(path.startsOn, ISO_DATE)
    required(path.endsOn)
    pattern(path.endsOn, ISO_DATE)
    validate(path.endsOn, ({ value, valueOf }) =>
      value() && value() < valueOf(path.startsOn) ? { kind: 'endsBeforeStart' } : undefined
    )
    required(path.baseCurrency)
    pattern(path.baseCurrency, CURRENCY)
    disabled(path.baseCurrency, () => this.ownerOnly())
    pattern(path.budgetTotal, /^\s*$|^\d+(\.\d+)?$/)
    required(path.homeTz)
  })

  protected async save(event: Event): Promise<void> {
    event.preventDefault()
    await submit(this.form, async () => {
      const trip = this.data.trip
      const next = this.model()
      const currency = next.baseCurrency.toUpperCase()
      const changes: Record<string, unknown> = {}
      if (next.name !== trip.name) changes['name'] = next.name
      if (next.startsOn !== trip.startDate) changes['startsOn'] = next.startsOn
      if (next.endsOn !== trip.endDate) changes['endsOn'] = next.endsOn
      if (!this.ownerOnly() && currency !== trip.baseCurrency) changes['baseCurrency'] = currency
      if (next.budgetMode !== trip.budgetMode) changes['budgetMode'] = next.budgetMode
      const budgetTotalMinor = toMinor(next.budgetTotal, currency)
      if (budgetTotalMinor !== (trip.budgetTotalMinor ?? null)) {
        changes['budgetTotalMinor'] = budgetTotalMinor
      }
      if (next.homeTz !== trip.homeTz) changes['homeTz'] = next.homeTz
      if (Object.keys(changes).length > 0) {
        await this.content.upsert({ tripId: trip.id, entity: 'trip', id: trip.id, changes })
        this.toasts.show({ message: this.transloco.translate('trip.edit.saved') })
      }
      this.ref.close()
      return undefined
    })
  }
}

function toMajor(minor: number | null, currency: string): string {
  if (minor === null) {
    return ''
  }
  const { exponent } = minorUnitExponent(currency)
  return (minor / 10 ** exponent).toFixed(exponent)
}

function toMinor(major: string, currency: string): number | null {
  const trimmed = major.trim()
  if (trimmed === '') {
    return null
  }
  const { exponent } = minorUnitExponent(currency)
  return Math.round(Number(trimmed) * 10 ** exponent)
}
