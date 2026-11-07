import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { provideAccountI18n } from './account-i18n'

export interface SignOutSheetData {
  /** Outbox entries that have not reached the server (pending, syncing or failed). */
  pendingCount: number
}

/**
 * The warning before signing out while the outbox still holds changes:
 * they are lost with the device's copy. Closes with `true` to go ahead.
 */
@Component({
  selector: 'app-sign-out-sheet',
  imports: [TranslocoPipe, MkSheetComponent, MkButtonComponent],
  providers: [provideAccountI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'account.signOut.pendingTitle' | transloco">
      <p class="text-sm text-ink-1" data-testid="account.signOut.warning">
        {{ 'account.signOut.pendingBody' | transloco: { count: data.pendingCount } }}
      </p>
      <div class="mt-6 flex flex-col gap-3">
        <button
          mk-button
          variant="secondary"
          type="button"
          data-testid="account.signOut.cancel"
          (click)="ref.close(false)"
        >
          {{ 'account.signOut.cancel' | transloco }}
        </button>
        <button
          mk-button
          type="button"
          data-testid="account.signOut.confirm"
          (click)="ref.close(true)"
        >
          {{ 'account.signOut.confirm' | transloco }}
        </button>
      </div>
    </mk-sheet>
  `,
})
export class SignOutSheet {
  protected readonly data = inject<SignOutSheetData>(DIALOG_DATA)
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef)
}
