import { DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { provideShellI18n } from '../../layouts/shell/shell-i18n'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'

/** The style guide's demo sheet: a title, a sentence and one closing action. */
@Component({
  selector: 'app-sample-sheet',
  imports: [TranslocoPipe, MkSheetComponent, MkButtonComponent],
  providers: [provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'shell.styleguide.sample.sheetTitle' | transloco">
      <p class="text-sm text-ink-2" data-testid="styleguide.sheet.body">
        {{ 'shell.styleguide.sample.sheetBody' | transloco }}
      </p>
      <button
        mk-button
        type="button"
        class="mt-4 w-full"
        data-testid="styleguide.sheet.close"
        (click)="ref.close()"
      >
        {{ 'ui.sheet.close' | transloco }}
      </button>
    </mk-sheet>
  `,
})
export class SampleSheet {
  protected readonly ref = inject(DialogRef)
}
