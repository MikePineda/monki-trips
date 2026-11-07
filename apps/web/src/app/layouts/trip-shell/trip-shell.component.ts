import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { RouterOutlet } from '@angular/router'
import { TRANSLOCO_SCOPE, TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { OFFLINE_DB } from '../../core/offline/offline-db'
import { META_ACTIVE_TRIP, MetaStore } from '../../core/offline/meta.store'
import { MkTabBarComponent, type TabItem } from '../../shared/ui/tab-bar/tab-bar.component'
import { ShellHeaderComponent } from '../shell/shell-header.component'
import { provideShellI18n } from '../shell/shell-i18n'
import type { IconName } from '../../shared/ui/icon/icon-names'

/** The five tabs of a trip, in order. */
export const TRIP_TABS: readonly { id: string; icon: IconName }[] = [
  { id: 'today', icon: 'compass' },
  { id: 'plan', icon: 'calendar' },
  { id: 'docs', icon: 'file-text' },
  { id: 'money', icon: 'wallet' },
  { id: 'more', icon: 'ellipsis' },
]

/**
 * The frame inside a trip (`/t/:tripId`): header with a way back to the
 * list, the trip name (from the device's copy) and the connection
 * indicator; the routed tab below; the five-tab bar at the bottom. Entering
 * a trip makes it the active one for the "Add expense" shortcut.
 */
@Component({
  selector: 'app-trip-shell',
  imports: [RouterOutlet, TranslocoPipe, ShellHeaderComponent, MkTabBarComponent],
  providers: [provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-shell-header [title]="title()" backLink="/trips" />
    <main class="mx-auto max-w-2xl px-4 py-6 pb-24">
      <router-outlet />
    </main>
    <mk-tab-bar [tabs]="tabs()" [label]="'shell.tabs.label' | transloco" />
  `,
})
export class TripShellComponent {
  /** Bound from the route parameter. */
  readonly tripId = input.required<string>()

  private readonly database = inject(OFFLINE_DB)
  private readonly meta = inject(MetaStore)
  private readonly transloco = inject(TranslocoService)
  /** This component's own `shell` scope, so the service loads it like the pipe does. */
  private readonly scope = inject(TRANSLOCO_SCOPE)
  private readonly tripName = signal<string | null>(null)

  /** Tab labels in the active language, re-emitted when it changes or its catalogue loads. */
  private readonly tabLabels = toSignal(
    this.transloco.selectTranslate<string[]>(
      TRIP_TABS.map((tab) => `tabs.${tab.id}`),
      {},
      this.scope
    ),
    { initialValue: [] as string[] }
  )
  private readonly untitled = toSignal(
    this.transloco.selectTranslate<string>('trip.untitled', {}, this.scope),
    { initialValue: '' }
  )

  protected readonly title = computed(() => this.tripName() ?? this.untitled())

  protected readonly tabs = computed<TabItem[]>(() =>
    TRIP_TABS.map((tab, index) => ({
      id: tab.id,
      icon: tab.icon,
      label: this.tabLabels()[index] ?? '',
      link: ['/t', this.tripId(), tab.id],
    }))
  )

  constructor() {
    effect(() => {
      const tripId = this.tripId()
      void this.database
        .then((db) => db.trips.get(tripId))
        .then((trip) => this.tripName.set(trip?.name ?? null))
      void this.meta.set(META_ACTIVE_TRIP, tripId)
    })
  }
}
