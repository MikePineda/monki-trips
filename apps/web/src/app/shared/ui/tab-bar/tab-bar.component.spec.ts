import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { Router, provideRouter } from '@angular/router'
import { MkTabBarComponent, type TabItem } from './tab-bar.component'

@Component({ template: '' })
class Blank {}

const TABS: TabItem[] = [
  { id: 'today', label: 'Today', icon: 'compass', link: '/t/demo/today' },
  { id: 'plan', label: 'Plan', icon: 'calendar', link: '/t/demo/plan' },
  { id: 'money', label: 'Money', icon: 'wallet', link: '/t/demo/money' },
]

describe('mk-tab-bar', () => {
  async function render() {
    TestBed.configureTestingModule({
      imports: [MkTabBarComponent],
      providers: [provideRouter([{ path: '**', component: Blank }])],
    })
    const fixture = TestBed.createComponent(MkTabBarComponent)
    fixture.componentRef.setInput('tabs', TABS)
    fixture.componentRef.setInput('label', 'Trip')
    fixture.detectChanges()
    await fixture.whenStable()
    return { fixture, router: TestBed.inject(Router), host: fixture.nativeElement as HTMLElement }
  }

  it('renders one labelled link per tab inside a named navigation', async () => {
    const { host } = await render()
    const links = [...host.querySelectorAll('a')]

    expect(host.querySelector('nav')?.getAttribute('aria-label')).toBe('Trip')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(TABS.map((tab) => tab.link))
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Today', 'Plan', 'Money'])
    expect(links.map((link) => link.dataset['testid'])).toEqual([
      'shell.tab.today',
      'shell.tab.plan',
      'shell.tab.money',
    ])
  })

  it('marks the tab of the current route as the current page', async () => {
    const { fixture, router, host } = await render()

    await router.navigateByUrl('/t/demo/money')
    fixture.detectChanges()
    await fixture.whenStable()

    const current = [...host.querySelectorAll('a')].filter(
      (link) => link.getAttribute('aria-current') === 'page'
    )
    expect(current.map((link) => link.dataset['testid'])).toEqual(['shell.tab.money'])
    expect(current[0].classList.contains('mk-tab--active')).toBe(true)
  })
})
