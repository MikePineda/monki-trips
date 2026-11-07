import { ChangeDetectionStrategy, Component } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { provideSettingsI18n } from './settings-i18n'

/** iOS has no install prompt: the three Safari steps, in a sheet. */
@Component({
  selector: 'app-install-instructions-sheet',
  imports: [TranslocoPipe, MkSheetComponent],
  providers: [provideSettingsI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'settings.install.iosTitle' | transloco">
      <ol class="list-decimal space-y-2 pl-5 text-sm text-ink-1" data-testid="settings.install.ios">
        <li>{{ 'settings.install.iosStep1' | transloco }}</li>
        <li>{{ 'settings.install.iosStep2' | transloco }}</li>
        <li>{{ 'settings.install.iosStep3' | transloco }}</li>
      </ol>
    </mk-sheet>
  `,
})
export class InstallInstructionsSheet {}
