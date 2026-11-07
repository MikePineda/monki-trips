import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  inject,
  signal,
} from '@angular/core'
import { form, FormField, maxLength, required, submit } from '@angular/forms/signals'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { firstValueFrom } from 'rxjs'
import { ACCOUNT_API } from '../../core/api/account-api'
import { ApiFailure } from '../../core/api/api-failure'
import { fieldError } from '../../core/forms/field-error'
import { serverFieldErrors } from '../../core/forms/server-errors'
import { OutboxStore } from '../../core/offline/outbox.store'
import { SessionStore } from '../../core/session/session.store'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { ACCOUNT_ERROR_CODES, provideAccountI18n } from './account-i18n'
import { ChangePasswordSheet } from './change-password.sheet'
import { DeleteAccountSheet } from './delete-account.sheet'
import { SignOutSheet, type SignOutSheetData } from './sign-out.sheet'

/** File name of the JSON the export downloads as. */
export const EXPORT_FILE_NAME = 'monki-trips-export.json'

/**
 * The Account part of Settings: display name, e-mail (read-only, with its
 * verification state), change password, sign out everywhere, export the
 * data as one JSON file, delete the account, and sign out (with a warning
 * while the outbox still holds changes). Nothing here renders for an
 * anonymous visitor.
 */
@Component({
  selector: 'app-account-section',
  imports: [
    RouterLink,
    TranslocoPipe,
    FormField,
    MkFieldComponent,
    MkButtonComponent,
    MkIconComponent,
    MkApiErrorComponent,
  ],
  providers: [provideAccountI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (session.user(); as user) {
      <section class="mt-6" data-testid="account.section">
        <h2 class="text-sm font-medium text-ink-2">{{ 'account.title' | transloco }}</h2>

        <form class="mt-3 flex flex-col gap-3" novalidate (submit)="saveName($event)">
          <mk-field
            [label]="'account.profile.displayName' | transloco"
            [hint]="'account.profile.displayNameHint' | transloco"
            [required]="true"
            [error]="fieldError(nameForm.displayName)"
          >
            <input
              type="text"
              autocomplete="name"
              [formField]="nameForm.displayName"
              data-testid="account.displayName"
            />
          </mk-field>
          <mk-api-error
            [failure]="nameFailure()"
            scope="account"
            [knownCodes]="codes"
            testId="account.displayName.error"
          />
          <div>
            <button
              mk-button
              variant="secondary"
              type="submit"
              [loading]="savingName()"
              [disabled]="!nameChanged()"
              data-testid="account.displayName.save"
            >
              {{ 'account.profile.save' | transloco }}
            </button>
          </div>
        </form>

        <mk-field
          class="mt-4"
          [label]="'account.profile.email' | transloco"
          [hint]="'account.profile.emailHint' | transloco"
        >
          <input type="email" readonly [value]="user.email" data-testid="account.email" />
        </mk-field>
        <p class="mt-1 flex items-center gap-1 text-sm" data-testid="account.emailState">
          @if (user.emailVerifiedAt) {
            <mk-icon name="circle-check" class="text-status-good" [size]="16" />
            <span class="text-ink-2">{{ 'account.profile.verified' | transloco }}</span>
          } @else {
            <mk-icon name="circle-alert" class="text-status-warning" [size]="16" />
            <span class="text-ink-2">{{ 'account.profile.unverified' | transloco }}</span>
            <a
              routerLink="/verify-email"
              class="ml-1 font-medium text-accent"
              data-testid="account.verify"
            >
              {{ 'account.profile.verify' | transloco }}
            </a>
          }
        </p>

        <div class="mt-6 flex flex-col items-start gap-3">
          <button
            mk-button
            variant="secondary"
            type="button"
            data-testid="account.password.change"
            (click)="changePassword()"
          >
            <mk-icon name="key-round" [size]="18" />
            {{ 'account.password.action' | transloco }}
          </button>
          <button
            mk-button
            variant="secondary"
            type="button"
            [loading]="signingOutEverywhere()"
            data-testid="account.signOutEverywhere"
            (click)="signOutEverywhere()"
          >
            {{ 'account.sessions.signOutEverywhere' | transloco }}
          </button>
          <button
            mk-button
            variant="secondary"
            type="button"
            [loading]="exporting()"
            data-testid="account.export"
            (click)="exportData()"
          >
            <mk-icon name="download" [size]="18" />
            {{ 'account.export.action' | transloco }}
          </button>
          <p class="text-xs text-ink-3">{{ 'account.export.body' | transloco }}</p>
          <mk-api-error
            [failure]="actionFailure()"
            scope="account"
            [knownCodes]="codes"
            testId="account.error"
          />
        </div>

        <div class="mt-8 flex flex-col items-start gap-3 border-t border-line pt-6">
          <button
            mk-button
            variant="secondary"
            type="button"
            [loading]="signingOut()"
            data-testid="account.signOut"
            (click)="signOut()"
          >
            <mk-icon name="log-out" [size]="18" />
            {{ 'account.signOut.action' | transloco }}
          </button>
          <mk-api-error
            [failure]="signOutFailure()"
            scope="account"
            [knownCodes]="codes"
            testId="account.signOut.error"
          />
          <button
            mk-button
            variant="ghost"
            type="button"
            class="text-status-critical"
            data-testid="account.delete"
            (click)="deleteAccount()"
          >
            <mk-icon name="trash-2" [size]="18" />
            {{ 'account.delete.action' | transloco }}
          </button>
        </div>
      </section>
    }
  `,
})
export class AccountSectionComponent {
  private readonly api = inject(ACCOUNT_API)
  private readonly outbox = inject(OutboxStore)
  private readonly sheets = inject(SheetService)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)
  private readonly router = inject(Router)
  private readonly document = inject(DOCUMENT)
  protected readonly session = inject(SessionStore)

  protected readonly codes = ACCOUNT_ERROR_CODES
  protected readonly fieldError = fieldError
  protected readonly nameModel = signal({ displayName: this.session.user()?.displayName ?? '' })
  protected readonly nameForm = form(this.nameModel, (path) => {
    required(path.displayName)
    maxLength(path.displayName, 80)
  })
  protected readonly nameChanged = computed(
    () => this.nameModel().displayName.trim() !== (this.session.user()?.displayName ?? '')
  )
  protected readonly savingName = signal(false)
  protected readonly nameFailure = signal<ApiFailure | null>(null)
  protected readonly signingOutEverywhere = signal(false)
  protected readonly exporting = signal(false)
  protected readonly signingOut = signal(false)
  protected readonly actionFailure = signal<ApiFailure | null>(null)
  /** Why the last sign-out did not happen; the button stays for another try. */
  protected readonly signOutFailure = signal<ApiFailure | null>(null)

  protected async saveName(event: Event): Promise<void> {
    event.preventDefault()
    this.nameFailure.set(null)
    await submit(this.nameForm, async () => {
      this.savingName.set(true)
      try {
        const user = await this.api.updateProfile({
          displayName: this.nameModel().displayName.trim(),
        })
        await this.session.setUser(user)
        this.toasts.show({ message: this.transloco.translate('account.profile.saved') })
        return undefined
      } catch (error) {
        const failure = toFailure(error)
        if (!(await this.session.handleUnauthorized(failure))) {
          this.nameFailure.set(failure)
        }
        return serverFieldErrors(failure, this.nameForm)
      } finally {
        this.savingName.set(false)
      }
    })
  }

  protected changePassword(): void {
    const ref = this.sheets.open<boolean>(ChangePasswordSheet)
    ref.closed.subscribe((changed) => {
      if (changed) {
        this.toasts.show({ message: this.transloco.translate('account.password.changed') })
      }
    })
  }

  protected async signOutEverywhere(): Promise<void> {
    await this.runAction(this.signingOutEverywhere, async () => {
      await this.session.signOutEverywhere()
      this.toasts.show({ message: this.transloco.translate('account.sessions.done') })
    })
  }

  protected async exportData(): Promise<void> {
    await this.runAction(this.exporting, async () => {
      const data = await this.api.exportData()
      this.download(JSON.stringify(data, null, 2))
      this.toasts.show({ message: this.transloco.translate('account.export.done') })
    })
  }

  protected deleteAccount(): void {
    const ref = this.sheets.open<boolean>(DeleteAccountSheet)
    ref.closed.subscribe((deleted) => {
      if (deleted) {
        void this.leaveAfterDeletion()
      }
    })
  }

  /** Signs out; with changes still in the outbox the person confirms first. */
  protected async signOut(): Promise<void> {
    const pending = this.outbox.pendingCount()
    if (pending > 0) {
      const ref = this.sheets.open<boolean, SignOutSheetData>(SignOutSheet, {
        data: { pendingCount: pending },
      })
      const confirmed = await firstValueFrom(ref.closed)
      if (!confirmed) {
        return
      }
    }
    await this.runAction(
      this.signingOut,
      async () => {
        await this.session.signOut()
        await this.router.navigateByUrl('/login')
      },
      this.signOutFailure
    )
  }

  private async leaveAfterDeletion(): Promise<void> {
    this.toasts.show({ message: this.transloco.translate('account.delete.done') })
    // The server already ended every session; a logout answers 401, which signOut treats as done.
    await this.session.signOut().catch(() => undefined)
    await this.router.navigateByUrl('/login')
  }

  private async runAction(
    busy: ReturnType<typeof signal<boolean>>,
    action: () => Promise<void>,
    failed: ReturnType<typeof signal<ApiFailure | null>> = this.actionFailure
  ): Promise<void> {
    busy.set(true)
    failed.set(null)
    try {
      await action()
    } catch (error) {
      const failure = toFailure(error)
      if (!(await this.session.handleUnauthorized(failure))) {
        failed.set(failure)
      }
    } finally {
      busy.set(false)
    }
  }

  /** Hands the JSON to the browser as a file download. */
  private download(json: string): void {
    const view = this.document.defaultView
    if (!view) {
      return
    }
    const url = view.URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const anchor = this.document.createElement('a')
    anchor.href = url
    anchor.download = EXPORT_FILE_NAME
    anchor.rel = 'noopener'
    this.document.body.append(anchor)
    anchor.click()
    anchor.remove()
    view.URL.revokeObjectURL(url)
  }
}

function toFailure(error: unknown): ApiFailure {
  return error instanceof ApiFailure
    ? error
    : new ApiFailure({ kind: 'network', message: String(error) })
}
