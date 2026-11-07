import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkButtonComponent } from '../button/button.component'
import { MkStackComponent } from '../layout/stack.component'
import { MkTextComponent } from '../text/text.component'
import { provideUiI18n } from '../ui-i18n'
import { MkSheetComponent } from './sheet.component'

/** Copy of a confirmation, already translated by the caller. */
export interface ConfirmSheetData {
  title: string
  body: string
  confirmLabel: string
  /** Defaults to the ui catalogue's "Cancel". */
  cancelLabel?: string
  /** A destructive confirmation keeps the secondary look with a critical label (never a red fill). */
  destructive?: boolean
}

/**
 * A yes/no bottom sheet: title, one sentence, cancel and the action. Opened
 * through `SheetService.confirm()`, it closes with `true` when the person
 * confirms and `false` otherwise (cancel, Escape, backdrop).
 */
@Component({
  selector: 'mk-confirm-sheet',
  imports: [TranslocoPipe, MkSheetComponent, MkButtonComponent, MkStackComponent, MkTextComponent],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="data.title">
      <p mk-text data-testid="ui.confirm.body">{{ data.body }}</p>
      <mk-stack mkSheetFooter gap="2">
        <button
          mk-button
          variant="secondary"
          size="block"
          type="button"
          data-testid="ui.confirm.cancel"
          (click)="ref.close(false)"
        >
          {{ data.cancelLabel ?? ('ui.actions.cancel' | transloco) }}
        </button>
        <button
          mk-button
          [variant]="data.destructive ? 'destructive' : 'primary'"
          size="block"
          type="button"
          data-testid="ui.confirm.confirm"
          (click)="ref.close(true)"
        >
          {{ data.confirmLabel }}
        </button>
      </mk-stack>
    </mk-sheet>
  `,
})
export class MkConfirmSheetComponent {
  protected readonly data = inject<ConfirmSheetData>(DIALOG_DATA)
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef)
}
