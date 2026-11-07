import { DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import {
  form,
  FormField,
  maxLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals'
import { TranslocoPipe } from '@jsverse/transloco'
import { BUDGET_MODES, type BudgetMode, type Trip } from '@monkitrips/shared'
import { ApiFailure } from '../../core/api/api-failure'
import { fieldError } from '../../core/forms/field-error'
import { serverFieldErrors } from '../../core/forms/server-errors'
import { SessionStore } from '../../core/session/session.store'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { provideShellI18n } from '../../layouts/shell/shell-i18n'
import { TripsStore } from './trips.store'

/** Error codes the shell catalogue explains for trip creation (`shell.errors.<code>`). */
export const TRIP_ERROR_CODES = [
  'E_EMAIL_NOT_VERIFIED',
  'E_VALIDATION_ERROR',
  'E_TOO_MANY_REQUESTS',
  'E_UNAUTHORIZED',
  'E_BAD_CSRF_TOKEN',
] as const

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CURRENCY = /^[A-Za-z]{3}$/

export interface CreateTripModel {
  name: string
  startsOn: string
  endsOn: string
  baseCurrency: string
  budgetMode: BudgetMode
}

/**
 * The "new trip" form in a bottom sheet: name, dates, base currency and
 * budget mode. Closes with the created trip; the page then opens it.
 */
@Component({
  selector: 'app-create-trip-sheet',
  imports: [
    TranslocoPipe,
    FormField,
    MkSheetComponent,
    MkFieldComponent,
    MkButtonComponent,
    MkApiErrorComponent,
  ],
  providers: [provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'shell.trips.create.title' | transloco">
      <form class="flex flex-col gap-4" novalidate (submit)="save($event)">
        <mk-field
          [label]="'shell.trips.create.name' | transloco"
          [required]="true"
          [error]="fieldError(form.name)"
        >
          <input
            type="text"
            autocomplete="off"
            [formField]="form.name"
            data-testid="trips.create.name"
          />
        </mk-field>
        <div class="grid grid-cols-2 gap-3">
          <mk-field
            [label]="'shell.trips.create.startsOn' | transloco"
            [required]="true"
            [error]="fieldError(form.startsOn)"
          >
            <input type="date" [formField]="form.startsOn" data-testid="trips.create.startsOn" />
          </mk-field>
          <mk-field
            [label]="'shell.trips.create.endsOn' | transloco"
            [required]="true"
            [error]="fieldError(form.endsOn)"
          >
            <input type="date" [formField]="form.endsOn" data-testid="trips.create.endsOn" />
          </mk-field>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <mk-field
            [label]="'shell.trips.create.baseCurrency' | transloco"
            [hint]="'shell.trips.create.baseCurrencyHint' | transloco"
            [required]="true"
            [error]="fieldError(form.baseCurrency)"
          >
            <input
              type="text"
              autocapitalize="characters"
              class="uppercase"
              [formField]="form.baseCurrency"
              data-testid="trips.create.baseCurrency"
            />
          </mk-field>
          <mk-field [label]="'shell.trips.create.budgetMode' | transloco" [required]="true">
            <select [formField]="form.budgetMode" data-testid="trips.create.budgetMode">
              @for (mode of budgetModes; track mode) {
                <option [value]="mode">
                  {{ 'shell.trips.create.budget.' + mode | transloco }}
                </option>
              }
            </select>
          </mk-field>
        </div>
        <mk-api-error
          [failure]="failure()"
          scope="shell"
          [knownCodes]="codes"
          testId="trips.create.error"
        />
        <button mk-button type="submit" [loading]="busy()" data-testid="trips.create.submit">
          {{ 'shell.trips.create.submit' | transloco }}
        </button>
      </form>
    </mk-sheet>
  `,
})
export class CreateTripSheet {
  private readonly store = inject(TripsStore)
  private readonly session = inject(SessionStore)
  private readonly ref = inject<DialogRef<Trip>>(DialogRef)

  protected readonly codes = TRIP_ERROR_CODES
  protected readonly budgetModes = BUDGET_MODES
  protected readonly fieldError = fieldError
  protected readonly model = signal<CreateTripModel>({
    name: '',
    startsOn: '',
    endsOn: '',
    baseCurrency: '',
    budgetMode: 'shared',
  })
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
    maxLength(path.baseCurrency, 3)
    pattern(path.baseCurrency, CURRENCY)
  })
  protected readonly busy = signal(false)
  protected readonly failure = signal<ApiFailure | null>(null)

  protected async save(event: Event): Promise<void> {
    event.preventDefault()
    this.failure.set(null)
    await submit(this.form, async () => {
      this.busy.set(true)
      try {
        const { budgetMode, ...rest } = this.model()
        const trip = await this.store.create({
          ...rest,
          baseCurrency: rest.baseCurrency.toUpperCase(),
          budgetMode,
        })
        this.ref.close(trip)
        return undefined
      } catch (error) {
        const failure =
          error instanceof ApiFailure
            ? error
            : new ApiFailure({ kind: 'network', message: String(error) })
        if (await this.session.handleUnauthorized(failure)) {
          this.ref.close()
          return undefined
        }
        this.failure.set(failure)
        return serverFieldErrors(failure, this.form)
      } finally {
        this.busy.set(false)
      }
    })
  }
}
