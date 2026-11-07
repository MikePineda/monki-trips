import { ChangeDetectionStrategy, Component } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { MkStepsComponent } from '../../shared/ui/steps/steps.component'
import { provideSettingsI18n } from './settings-i18n'

/** iOS has no install prompt: the three Safari steps, in a sheet. */
@Component({
  selector: 'app-install-instructions-sheet',
  imports: [TranslocoPipe, MkSheetComponent, MkStepsComponent],
  providers: [provideSettingsI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'settings.install.iosTitle' | transloco">
      <mk-steps
        [steps]="[
          'settings.install.iosStep1' | transloco,
          'settings.install.iosStep2' | transloco,
          'settings.install.iosStep3' | transloco,
        ]"
        data-testid="settings.install.ios"
      />
    </mk-sheet>
  `,
})
export class InstallInstructionsSheet {}
