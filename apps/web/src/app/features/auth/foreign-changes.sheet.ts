import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { provideAuthI18n } from './auth-i18n'

export interface ForeignChangesSheetData {
  /** Unsynced outbox entries of the account that used the device before. */
  count: number
}

/**
 * Asked when an account signs in (or signs up) on a device that still
 * holds another account's unsynced changes: continuing discards them.
 * Closes with `true` to discard and continue, anything else to keep them.
 */
@Component({
  selector: 'app-foreign-changes-sheet',
  imports: [TranslocoPipe, MkSheetComponent, MkButtonComponent, MkStackComponent, MkTextComponent],
  providers: [provideAuthI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'auth.foreignChanges.title' | transloco">
      <p mk-text data-testid="auth.foreignChanges.body">
        {{ 'auth.foreignChanges.body' | transloco: { count: data.count } }}
      </p>
      <mk-stack mkSheetFooter gap="2">
        <button
          mk-button
          variant="secondary"
          size="block"
          type="button"
          data-testid="auth.foreignChanges.keep"
          (click)="ref.close(false)"
        >
          {{ 'auth.foreignChanges.keep' | transloco }}
        </button>
        <button
          mk-button
          size="block"
          type="button"
          data-testid="auth.foreignChanges.discard"
          (click)="ref.close(true)"
        >
          {{ 'auth.foreignChanges.discard' | transloco }}
        </button>
      </mk-stack>
    </mk-sheet>
  `,
})
export class ForeignChangesSheet {
  protected readonly data = inject<ForeignChangesSheetData>(DIALOG_DATA)
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef)
}
