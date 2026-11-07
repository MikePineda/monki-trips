import { TestBed } from '@angular/core/testing'
import { TranslocoService } from '@jsverse/transloco'
import { i18nTesting } from '../../../../testing/i18n-testing'
import type { ConnectionStatus } from '../../../domain/connection-status'
import { MkConnectionStatusComponent } from './connection-status.component'

describe('mk-connection-status', () => {
  function render(status: ConnectionStatus, lang = 'en') {
    TestBed.configureTestingModule({ imports: [MkConnectionStatusComponent, i18nTesting()] })
    TestBed.inject(TranslocoService).setActiveLang(lang)
    const fixture = TestBed.createComponent(MkConnectionStatusComponent)
    fixture.componentRef.setInput('status', status)
    fixture.detectChanges()
    return fixture.nativeElement.querySelector(
      '[data-testid="shell.connection"]'
    ) as HTMLElement | null
  }

  it('renders nothing when synced', () => {
    expect(render({ state: 'synced', count: 0 })).toBeNull()
  })

  it.each<[ConnectionStatus, string]>([
    [{ state: 'failed', count: 1 }, '1 change needs attention'],
    [{ state: 'failed', count: 2 }, '2 changes need attention'],
    [{ state: 'offline', count: 3 }, 'Offline · everything saved'],
    [{ state: 'syncing', count: 3 }, 'Syncing 3…'],
    [{ state: 'pending', count: 1 }, '1 pending'],
    [{ state: 'pending', count: 3 }, '3 pending'],
    [{ state: 'stale', count: 1 }, 'Data from 1 day ago'],
    [{ state: 'stale', count: 2 }, 'Data from 2 days ago'],
  ])('shows the copy of %o as a status with an icon', (status, copy) => {
    const element = render(status)

    expect(element?.getAttribute('role')).toBe('status')
    expect(element?.dataset['state']).toBe(status.state)
    expect(element?.textContent?.replace(/\s+/g, ' ').trim()).toBe(copy)
    expect(element?.querySelector('mk-icon svg')).not.toBeNull()
  })

  it('speaks spanish too', () => {
    expect(render({ state: 'offline', count: 0 }, 'es')?.textContent).toContain(
      'Sin conexión · todo guardado'
    )
  })
})
