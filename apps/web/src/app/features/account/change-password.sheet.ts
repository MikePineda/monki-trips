import { DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { form, FormField, minLength, required, submit } from '@angular/forms/signals'
import { TranslocoPipe } from '@jsverse/transloco'
import { ACCOUNT_API } from '../../core/api/account-api'
import { ApiFailure } from '../../core/api/api-failure'
import { fieldError } from '../../core/forms/field-error'
import { serverFieldErrors } from '../../core/forms/server-errors'
import { SessionStore } from '../../core/session/session.store'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { ACCOUNT_ERROR_CODES, provideAccountI18n } from './account-i18n'

/** Shortest password the API accepts. */
const PASSWORD_MIN_LENGTH = 10

/** Current and new password in a sheet; closes with `true` when changed. */
@Component({
  selector: 'app-change-password-sheet',
  imports: [
    TranslocoPipe,
    FormField,
    MkSheetComponent,
    MkFieldComponent,
    MkButtonComponent,
    MkApiErrorComponent,
  ],
  providers: [provideAccountI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'account.password.title' | transloco">
      <form class="flex flex-col gap-4" novalidate (submit)="change($event)">
        <mk-field
          [label]="'account.password.current' | transloco"
          [required]="true"
          [error]="fieldError(form.currentPassword)"
        >
          <input
            type="password"
            autocomplete="current-password"
            [formField]="form.currentPassword"
            data-testid="account.password.current"
          />
        </mk-field>
        <mk-field
          [label]="'account.password.new' | transloco"
          [hint]="'account.password.newHint' | transloco"
          [required]="true"
          [error]="fieldError(form.password)"
        >
          <input
            type="password"
            autocomplete="new-password"
            [formField]="form.password"
            data-testid="account.password.new"
          />
        </mk-field>
        <mk-api-error
          [failure]="failure()"
          scope="account"
          [knownCodes]="codes"
          testId="account.password.error"
        />
        <button mk-button type="submit" [loading]="busy()" data-testid="account.password.submit">
          {{ 'account.password.submit' | transloco }}
        </button>
      </form>
    </mk-sheet>
  `,
})
export class ChangePasswordSheet {
  private readonly api = inject(ACCOUNT_API)
  private readonly session = inject(SessionStore)
  private readonly ref = inject<DialogRef<boolean>>(DialogRef)

  protected readonly codes = ACCOUNT_ERROR_CODES
  protected readonly fieldError = fieldError
  protected readonly model = signal({ currentPassword: '', password: '' })
  protected readonly form = form(this.model, (path) => {
    required(path.currentPassword)
    required(path.password)
    minLength(path.password, PASSWORD_MIN_LENGTH)
  })
  protected readonly busy = signal(false)
  protected readonly failure = signal<ApiFailure | null>(null)

  protected async change(event: Event): Promise<void> {
    event.preventDefault()
    this.failure.set(null)
    await submit(this.form, async () => {
      this.busy.set(true)
      try {
        await this.api.changePassword(this.model())
        this.ref.close(true)
        return undefined
      } catch (error) {
        const failure =
          error instanceof ApiFailure
            ? error
            : new ApiFailure({ kind: 'network', message: String(error) })
        if (await this.session.handleUnauthorized(failure)) {
          this.ref.close(false)
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
