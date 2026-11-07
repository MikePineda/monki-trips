import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { ApiFailure } from '../../core/api/api-failure'
import { PushService } from '../../core/push/push.service'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkSwitchComponent } from '../../shared/ui/switch/switch.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { InstallInstructionsSheet } from './install-instructions.sheet'
import { provideSettingsI18n, SETTINGS_ERROR_CODES } from './settings-i18n'

/**
 * The Notifications part of Settings: the switch for this device (the
 * permission prompt opens from its tap), the device's name, "Send a test",
 * and the honest states where nothing can be enabled: a browser without
 * push, an iOS tab (install first, with the instructions one tap away),
 * notifications blocked in the browser, a server without keys.
 */
@Component({
  selector: 'app-notifications-section',
  imports: [
    TranslocoPipe,
    MkApiErrorComponent,
    MkButtonComponent,
    MkFieldComponent,
    MkInputDirective,
    MkSectionComponent,
    MkStackComponent,
    MkSwitchComponent,
    MkTextComponent,
  ],
  providers: [provideSettingsI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <mk-section
      [eyebrow]="'settings.notifications.label' | transloco"
      data-testid="settings.notifications"
      [attr.data-status]="push.status()"
    >
      <mk-stack gap="2" align="start">
        @switch (push.status()) {
          @case ('unsupported') {
            <p mk-text tone="ink-2">{{ 'settings.notifications.unsupported' | transloco }}</p>
          }
          @case ('ios-install') {
            <p mk-text tone="ink-2">{{ 'settings.notifications.iosInstall' | transloco }}</p>
            <button
              mk-button
              variant="secondary"
              type="button"
              data-testid="settings.notifications.install"
              (click)="showInstallInstructions()"
            >
              {{ 'settings.notifications.iosAction' | transloco }}
            </button>
          }
          @case ('blocked') {
            <p mk-text tone="ink-2">{{ 'settings.notifications.blocked' | transloco }}</p>
          }
          @case ('server-off') {
            <p mk-text tone="ink-2">{{ 'settings.notifications.serverOff' | transloco }}</p>
          }
          @default {
            <mk-switch
              [checked]="push.status() === 'enabled'"
              [disabled]="push.busy()"
              (checkedChange)="toggle($event)"
              testId="settings.notifications.toggle"
            >
              {{ 'settings.notifications.toggle' | transloco }}
            </mk-switch>
            @if (push.status() === 'enabled') {
              <p mk-text variant="caption" tone="ink-2" data-testid="settings.notifications.state">
                {{ 'settings.notifications.enabled' | transloco }}
              </p>
              <button
                mk-button
                variant="secondary"
                type="button"
                [loading]="testing()"
                data-testid="settings.notifications.test"
                (click)="sendTest()"
              >
                {{ 'settings.notifications.sendTest' | transloco }}
              </button>
            } @else {
              <mk-field
                [label]="'settings.notifications.deviceLabel' | transloco"
                [hint]="'settings.notifications.deviceLabelHint' | transloco"
              >
                <input
                  mkInput
                  type="text"
                  autocomplete="off"
                  [value]="deviceLabel()"
                  (input)="deviceLabelChanged($event)"
                  data-testid="settings.notifications.deviceLabel"
                />
              </mk-field>
            }
            @if (needsGesture()) {
              <p mk-text variant="caption" tone="status-warning">
                {{ 'settings.notifications.needsGesture' | transloco }}
              </p>
            }
            <mk-api-error
              [failure]="failure()"
              scope="settings"
              [knownCodes]="codes"
              testId="settings.notifications.error"
            />
          }
        }
      </mk-stack>
    </mk-section>
  `,
})
export class NotificationsSectionComponent {
  protected readonly push = inject(PushService)
  private readonly sheets = inject(SheetService)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)

  protected readonly codes = SETTINGS_ERROR_CODES
  protected readonly deviceLabel = signal('')
  protected readonly testing = signal(false)
  protected readonly needsGesture = signal(false)
  protected readonly failure = signal<ApiFailure | null>(null)

  constructor() {
    if (this.push.availability() === 'available') {
      void this.push.loadConfig()
    }
  }

  protected deviceLabelChanged(event: Event): void {
    this.deviceLabel.set((event.target as HTMLInputElement).value)
  }

  /** The switch asked for `on` or `off`; the state follows what actually happened. */
  protected async toggle(on: boolean): Promise<void> {
    this.failure.set(null)
    this.needsGesture.set(false)
    try {
      if (on) {
        const outcome = await this.push.enable(this.deviceLabel())
        this.needsGesture.set(outcome === 'needs-gesture')
      } else {
        await this.push.disable()
      }
    } catch (error) {
      this.failure.set(toFailure(error))
    }
  }

  protected async sendTest(): Promise<void> {
    this.failure.set(null)
    this.testing.set(true)
    try {
      const result = await this.push.sendTest()
      this.toasts.show({
        message: this.transloco.translate(
          result.sent > 0 ? 'settings.notifications.testSent' : 'settings.notifications.testNone'
        ),
      })
    } catch (error) {
      this.failure.set(toFailure(error))
    } finally {
      this.testing.set(false)
    }
  }

  protected showInstallInstructions(): void {
    this.sheets.open(InstallInstructionsSheet)
  }
}

function toFailure(error: unknown): ApiFailure {
  return error instanceof ApiFailure
    ? error
    : new ApiFailure({ kind: 'network', message: String(error) })
}
