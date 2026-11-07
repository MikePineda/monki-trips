import { DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { provideStyleguideI18n } from './styleguide-i18n'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'

/** The style guide's demo sheet: a title, a sentence and one closing action. */
@Component({
  selector: 'app-sample-sheet',
  imports: [TranslocoPipe, MkSheetComponent, MkButtonComponent, MkTextComponent],
  providers: [provideStyleguideI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'styleguide.sample.sheetTitle' | transloco">
      <p mk-text tone="ink-2" data-testid="styleguide.sheet.body">
        {{ 'styleguide.sample.sheetBody' | transloco }}
      </p>
      <button
        mkSheetFooter
        mk-button
        size="block"
        type="button"
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
