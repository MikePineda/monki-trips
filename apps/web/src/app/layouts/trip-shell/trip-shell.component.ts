import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router'
import { filter, map, startWith } from 'rxjs'
import { TRANSLOCO_SCOPE, TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { META_ACTIVE_TRIP, MetaStore } from '../../core/offline/meta.store'
import { tripRecord } from '../../core/offline/trip-queries'
import { MkFabComponent } from '../../shared/ui/fab/fab.component'
import { MkIconButtonComponent } from '../../shared/ui/icon-button/icon-button.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkPageComponent } from '../../shared/ui/layout/page.component'
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
 * indicator; the routed tab below; the five-tab bar at the bottom; the
 * "Add expense" FAB everywhere but settings, the assistant chat (its
 * composer sticks to the bottom), the Plan tab (its own FAB) and the quick
 * expense itself.
 * Entering a trip makes it the active one for the "Add expense" shortcut.
 */
@Component({
  selector: 'app-trip-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    TranslocoPipe,
    ShellHeaderComponent,
    MkTabBarComponent,
    MkPageComponent,
    MkIconComponent,
    MkIconButtonComponent,
    MkFabComponent,
  ],
  providers: [provideShellI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-shell-header [title]="title()" backLink="/trips">
      <a
        mkTopBarActions
        mk-icon-button
        [routerLink]="['/t', tripId(), 'summary']"
        [attr.aria-label]="'shell.trip.summary' | transloco"
        data-testid="shell.summary"
      >
        <mk-icon name="info" />
      </a>
    </app-shell-header>
    <mk-page [tabBar]="true" [fab]="floatsButton()">
      <main>
        <router-outlet />
      </main>
    </mk-page>
    @if (showFab()) {
      <a mk-fab [routerLink]="['/t', tripId(), 'add']" data-testid="shell.fab">
        <mk-icon name="plus" />
        {{ 'shell.trip.add.title' | transloco }}
      </a>
    }
    <mk-tab-bar [tabs]="tabs()" [label]="'shell.tabs.label' | transloco" />
  `,
})
export class TripShellComponent {
  /** Bound from the route parameter. */
  readonly tripId = input.required<string>()

  private readonly meta = inject(MetaStore)
  private readonly transloco = inject(TranslocoService)
  /** This component's own `shell` scope, so the service loads it like the pipe does. */
  private readonly scope = inject(TRANSLOCO_SCOPE)
  /** The trip row, live: a rename in the summary shows in the header at once. */
  private readonly trip = tripRecord(this.tripId)

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

  private readonly router = inject(Router)
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  )
  /**
   * The quick-expense button, on every trip screen but settings and the
   * assistant (its composer is the screen's one floating control), and
   * under the quick expense sheet on its own route. The Plan tab floats its own "Add event" button and a
   * screen has one floating control (DESIGN.md), so it hides there too.
   */
  protected readonly showFab = computed(() => {
    const path = this.url().split(/[?#]/)[0]
    // Kept under the sheet on `/add`, so the sheet gives the focus back to it on close.
    return !/\/(more\/settings|more\/assistant|plan)(\/|$)/.test(path)
  })

  /**
   * Any floating button on this screen, the shell's or the Plan tab's own:
   * the page keeps `--fab-clearance` below its content for it.
   */
  protected readonly floatsButton = computed(() => {
    const path = this.url().split(/[?#]/)[0]
    return !/\/more\/(settings|assistant)(\/|$)/.test(path) && !/\/add$/.test(path)
  })

  protected readonly title = computed(() => this.trip()?.name ?? this.untitled())

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
      void this.meta.set(META_ACTIVE_TRIP, this.tripId())
    })
  }
}
