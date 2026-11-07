import { ChangeDetectionStrategy, Component } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { MkStepsComponent } from '../../shared/ui/steps/steps.component'
import { provideOfflineI18n } from './offline-i18n'

/**
 * iOS has no install prompt, and an iPhone keeps Safari's data apart from
 * the installed app's: the three steps, ending in "download everything
 * there".
 */
@Component({
  selector: 'app-offline-install-sheet',
  imports: [TranslocoPipe, MkSheetComponent, MkStepsComponent],
  providers: [provideOfflineI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'offline.install.title' | transloco">
      <mk-steps
        [steps]="[
          'offline.install.step1' | transloco,
          'offline.install.step2' | transloco,
          'offline.install.step3' | transloco,
        ]"
        data-testid="offline.install.steps"
      />
    </mk-sheet>
  `,
})
export class OfflineInstallSheet {}
