import { DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { form, FormField, required, submit } from '@angular/forms/signals'
import { TranslocoPipe } from '@jsverse/transloco'
import { ACCOUNT_API } from '../../core/api/account-api'
import { ApiFailure } from '../../core/api/api-failure'
import { fieldError } from '../../core/forms/field-error'
import { liveSignal } from '../../core/offline/live'
import type { TripRecord } from '../../core/offline/records'
import { SessionStore } from '../../core/session/session.store'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { ACCOUNT_ERROR_CODES, provideAccountI18n } from './account-i18n'

/**
 * Deleting the account: the password confirms it, the API schedules the
 * hard delete in 30 days and ends every session. While the person is the
 * only owner of trips other people use (409 `E_SOLE_OWNER_OF_SHARED_TRIPS`
 * with `tripIds`), the sheet lists those trips by name instead. Closes
 * with `true` once scheduled.
 */
@Component({
  selector: 'app-delete-account-sheet',
  imports: [
    TranslocoPipe,
    FormField,
    MkSheetComponent,
    MkFieldComponent,
    MkButtonComponent,
    MkApiErrorComponent,
    MkInputDirective,
    MkStackComponent,
    MkTextComponent,
    MkListComponent,
    MkListRowComponent,
  ],
  providers: [provideAccountI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'account.delete.title' | transloco">
      @if (blockingTrips(); as blocking) {
        <mk-stack gap="2" data-testid="account.delete.blocked">
          <mk-stack gap="half">
            <p mk-text variant="body-strong">{{ 'account.delete.blockedTitle' | transloco }}</p>
            <p mk-text tone="ink-2">{{ 'account.delete.blockedBody' | transloco }}</p>
          </mk-stack>
          <mk-list>
            @for (trip of blocking; track trip.id) {
              <mk-list-row
                [title]="trip.name ?? ('account.delete.unknownTrip' | transloco)"
                [link]="['/t', trip.id, 'more', 'members']"
                testId="account.delete.blockingTrip"
                (click)="ref.close(false)"
              />
            }
          </mk-list>
        </mk-stack>
      } @else {
        <form novalidate (submit)="remove($event)">
          <mk-stack gap="2">
            <p mk-text tone="ink-2">{{ 'account.delete.body' | transloco }}</p>
            <mk-field
              [label]="'account.delete.password' | transloco"
              [required]="true"
              [error]="fieldError(form.password)"
            >
              <input
                mkInput
                type="password"
                autocomplete="current-password"
                [formField]="form.password"
                data-testid="account.delete.password"
              />
            </mk-field>
            <mk-api-error
              [failure]="failure()"
              scope="account"
              [knownCodes]="codes"
              testId="account.delete.error"
            />
            <button
              mk-button
              variant="destructive"
              size="block"
              type="submit"
              [loading]="busy()"
              data-testid="account.delete.confirm"
            >
              {{ 'account.delete.confirm' | transloco }}
            </button>
          </mk-stack>
        </form>
      }
    </mk-sheet>
  `,
})
export class DeleteAccountSheet {
  private readonly api = inject(ACCOUNT_API)
  private readonly session = inject(SessionStore)
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef)

  protected readonly codes = ACCOUNT_ERROR_CODES
  protected readonly fieldError = fieldError
  protected readonly model = signal({ password: '' })
  protected readonly form = form(this.model, (path) => {
    required(path.password)
  })
  protected readonly busy = signal(false)
  protected readonly failure = signal<ApiFailure | null>(null)
  private readonly blockingIds = signal<string[] | null>(null)
  private readonly knownTrips = liveSignal<TripRecord[]>((db) => db.trips.toArray(), [])

  /** The trips that block the deletion, named from the device's copy when it has them. */
  protected readonly blockingTrips = computed(() => {
    const ids = this.blockingIds()
    if (!ids) {
      return null
    }
    const byId = new Map(this.knownTrips().map((trip) => [trip.id, trip]))
    return ids.map((id) => ({ id, name: byId.get(id)?.name ?? null }))
  })

  protected async remove(event: Event): Promise<void> {
    event.preventDefault()
    this.failure.set(null)
    await submit(this.form, async () => {
      this.busy.set(true)
      try {
        await this.api.deleteAccount(this.model().password)
        this.ref.close(true)
        return undefined
      } catch (error) {
        const failure =
          error instanceof ApiFailure
            ? error
            : new ApiFailure({ kind: 'network', message: String(error) })
        if (failure.is('E_SOLE_OWNER_OF_SHARED_TRIPS')) {
          const ids = failure.details['tripIds']
          this.blockingIds.set(Array.isArray(ids) ? ids.map(String) : [])
          return undefined
        }
        if (await this.session.handleUnauthorized(failure)) {
          this.ref.close(false)
          return undefined
        }
        this.failure.set(failure)
        return undefined
      } finally {
        this.busy.set(false)
      }
    })
  }
}
