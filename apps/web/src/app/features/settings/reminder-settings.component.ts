import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import type { NotificationSettings, ReminderKind } from '@monkitrips/shared'
import { intlLocale } from '../../core/i18n/intl-locale'
import { CLOCK } from '../../core/offline/clock'
import { OnlineStore } from '../../core/offline/online.store'
import type { FieldError } from '../../core/i18n/form-messages'
import { reminderFireTime } from '../../domain/reminder-fire-time'
import { MkApiErrorComponent } from '../../shared/ui/api-error/api-error.component'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import type { IconName } from '../../shared/ui/icon/icon-names'
import { MkRowComponent, MkRowGrowDirective } from '../../shared/ui/layout/row.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkListRowComponent } from '../../shared/ui/list/list-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkSwitchComponent } from '../../shared/ui/switch/switch.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { RemindersStore } from './reminders.store'
import { SETTINGS_ERROR_CODES } from './settings-i18n'

type ToggleKey = 'leaveAt' | 'checkOut' | 'tasksDue'

const TOGGLES: readonly ToggleKey[] = ['leaveAt', 'checkOut', 'tasksDue']

const KIND_ICONS: Readonly<Record<ReminderKind, IconName>> = {
  leave_at: 'navigation',
  check_out: 'bed',
  tasks_due: 'list-checks',
}

/** An app path (`/t/...`), never another origin (`//host`) or a scheme. */
const APP_PATH = /^\/(?!\/)/

/**
 * The account's push reminders inside Settings › Notifications: one switch
 * per kind (applies at once), quiet hours (both ends or neither, saved with
 * their own button) and the reminders the server plans for the next 36
 * hours, each opening its screen. Offline it shows what the device last
 * saw, read-only. Lives in the `settings` scope its parent provides.
 */
@Component({
  selector: 'app-reminder-settings',
  imports: [
    TranslocoPipe,
    MkApiErrorComponent,
    MkButtonComponent,
    MkEmptyStateComponent,
    MkFieldComponent,
    MkInputDirective,
    MkListComponent,
    MkListRowComponent,
    MkRowComponent,
    MkRowGrowDirective,
    MkStackComponent,
    MkSwitchComponent,
    MkTextComponent,
  ],
  providers: [RemindersStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <mk-stack gap="2" data-testid="settings.reminders" [attr.data-ready]="store.ready()">
      <mk-stack gap="half">
        <h2 mk-text variant="heading">{{ 'settings.reminders.label' | transloco }}</h2>
        <p mk-text variant="caption" tone="ink-2">{{ 'settings.reminders.hint' | transloco }}</p>
      </mk-stack>

      @if (!online()) {
        <p mk-text tone="offline" data-testid="settings.reminders.offline">
          {{
            (store.settings() ? 'settings.reminders.offline' : 'settings.reminders.notLoaded')
              | transloco
          }}
        </p>
      }

      @if (store.settings(); as settings) {
        <mk-stack gap="1" align="start">
          @for (key of toggles; track key) {
            <mk-switch
              [checked]="settings[key]"
              [disabled]="!editable()"
              (checkedChange)="toggle(key, $event)"
              [testId]="'settings.reminders.' + key"
            >
              {{ 'settings.reminders.' + key | transloco }}
            </mk-switch>
          }
        </mk-stack>

        <mk-stack gap="1">
          <mk-stack gap="half">
            <h3 mk-text variant="label">{{ 'settings.reminders.quietLabel' | transloco }}</h3>
            <p mk-text variant="caption" tone="ink-2">
              {{ 'settings.reminders.quietHint' | transloco }}
            </p>
          </mk-stack>
          <mk-row gap="2" align="start">
            <mk-field
              mkRowGrow
              [label]="'settings.reminders.quietStart' | transloco"
              [error]="quietError() === 'start' ? pairError() : null"
            >
              <input
                mkInput
                type="time"
                [value]="quietStart()"
                [disabled]="!editable()"
                (input)="quietStart.set(valueOf($event))"
                data-testid="settings.reminders.quietStart"
              />
            </mk-field>
            <mk-field
              mkRowGrow
              [label]="'settings.reminders.quietEnd' | transloco"
              [error]="quietError() === 'end' ? pairError() : null"
            >
              <input
                mkInput
                type="time"
                [value]="quietEnd()"
                [disabled]="!editable()"
                (input)="quietEnd.set(valueOf($event))"
                data-testid="settings.reminders.quietEnd"
              />
            </mk-field>
          </mk-row>
          <mk-row>
            <button
              mk-button
              variant="secondary"
              type="button"
              [disabled]="!editable()"
              [loading]="savingQuiet()"
              data-testid="settings.reminders.saveQuiet"
              (click)="saveQuietHours()"
            >
              {{ 'settings.reminders.saveQuiet' | transloco }}
            </button>
          </mk-row>
        </mk-stack>
      }

      <mk-api-error
        [failure]="store.failure()"
        scope="settings"
        [knownCodes]="codes"
        testId="settings.reminders.error"
      />

      <mk-stack gap="half" data-testid="settings.reminders.upcoming">
        <h3 mk-text variant="label">{{ 'settings.reminders.upcoming' | transloco }}</h3>
        @if (upcoming().length > 0) {
          <mk-list>
            @for (item of upcoming(); track item.kind + ':' + item.refId) {
              <mk-list-row
                data-testid="settings.reminders.upcoming.row"
                [attr.data-kind]="item.kind"
                [icon]="item.icon"
                [title]="item.title"
                [meta]="item.body"
                [value]="item.time"
                [link]="item.link"
              />
            }
          </mk-list>
        } @else {
          <mk-empty-state
            layout="compact"
            icon="clock"
            [title]="'settings.reminders.upcomingEmptyTitle' | transloco"
            [body]="'settings.reminders.upcomingEmptyBody' | transloco"
            data-testid="settings.reminders.upcoming.empty"
          />
        }
      </mk-stack>
    </mk-stack>
  `,
})
export class ReminderSettingsComponent {
  protected readonly store = inject(RemindersStore)
  protected readonly online = inject(OnlineStore).online
  private readonly clock = inject(CLOCK)
  private readonly locale = intlLocale()
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  protected readonly codes = SETTINGS_ERROR_CODES
  protected readonly toggles = TOGGLES
  /** The quiet-hours draft; it follows every settings object the store receives. */
  protected readonly quietStart = signal('')
  protected readonly quietEnd = signal('')
  private readonly quietAttempted = signal(false)
  protected readonly savingQuiet = signal(false)

  protected readonly editable = computed(() => this.online() && !this.store.saving())

  /** The empty end of a half-filled pair, once a save was attempted. */
  protected readonly quietError = computed<'start' | 'end' | null>(() => {
    if (!this.quietAttempted()) return null
    const start = this.quietStart()
    const end = this.quietEnd()
    if (start && !end) return 'end'
    if (end && !start) return 'start'
    return null
  })

  protected readonly pairError = computed<FieldError>(() => ({
    kind: 'quietHoursPair',
    message: this.transloco.translate('settings.reminders.quietPair'),
  }))

  /** Reminders still ahead (a list kept from yesterday drops what already fired), ready to show. */
  protected readonly upcoming = computed(() => {
    const now = this.clock()
    const nowMs = Date.parse(now)
    const locale = this.locale()
    return this.store
      .upcoming()
      .filter((item) => Date.parse(item.fireAt) > nowMs)
      .map((item) => ({
        kind: item.kind,
        refId: item.refId,
        title: item.title,
        body: item.body,
        icon: KIND_ICONS[item.kind],
        time: reminderFireTime({ instant: item.fireAt, now, timeZone: this.timeZone, locale }),
        link: APP_PATH.test(item.url) ? item.url : undefined,
      }))
  })

  constructor() {
    effect(() => {
      const settings = this.store.settings()
      untracked(() => {
        this.quietStart.set(settings?.quietHoursStart ?? '')
        this.quietEnd.set(settings?.quietHoursEnd ?? '')
      })
    })
    // Loads at once, and again whenever the connection comes back.
    effect(() => {
      this.online()
      untracked(() => void this.store.load())
    })
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value
  }

  /** The switch asked for a state; it shows it once the server saved it. */
  protected async toggle(key: ToggleKey, on: boolean): Promise<void> {
    const settings = this.store.settings()
    if (!settings || !this.editable()) return
    await this.store.save({ ...settings, [key]: on })
  }

  protected async saveQuietHours(): Promise<void> {
    const settings = this.store.settings()
    if (!settings || !this.editable()) return
    this.quietAttempted.set(true)
    if (this.quietError()) return
    const next: NotificationSettings = {
      ...settings,
      quietHoursStart: this.quietStart() || null,
      quietHoursEnd: this.quietEnd() || null,
    }
    this.savingQuiet.set(true)
    try {
      if (await this.store.save(next)) {
        this.quietAttempted.set(false)
        this.toasts.show({ message: this.transloco.translate('settings.reminders.saved') })
      }
    } finally {
      this.savingQuiet.set(false)
    }
  }
}
