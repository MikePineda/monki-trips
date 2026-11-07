import type { TabItem } from '../../../shared/ui/tab-bar/tab-bar.component'
import { TRIP_TABS } from '../../../layouts/trip-shell/trip-shell.component'

/** The five trip tabs for a mock screen, with one forced active (there is no router state behind a mock). */
export function mockTabs(labels: readonly string[], active: string): TabItem[] {
  return TRIP_TABS.map((tab, index) => ({
    id: tab.id,
    icon: tab.icon,
    label: labels[index] ?? tab.id,
    link: ['/styleguide'],
    active: tab.id === active,
  }))
}
