import { TestBed } from '@angular/core/testing'
import { TranslocoService } from '@jsverse/transloco'
import { i18nTesting } from '../../../testing/i18n-testing'
import { SCOPE_CATALOGUES } from '../../../testing/i18n-scopes'
import TripsPage from './trips.page'

describe('TripsPage', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [TripsPage, i18nTesting()] })
    const fixture = TestBed.createComponent(TripsPage)
    fixture.detectChanges()
    return fixture
  }

  it('shows an honest empty state while there are no trips', () => {
    const fixture = render()
    const empty = fixture.nativeElement.querySelector('[data-testid="trips.empty"]')

    expect(empty.textContent).toContain(SCOPE_CATALOGUES.shell.en.trips.emptyTitle)
    expect(empty.querySelector('button')).toBeNull()
  })

  it('renders the empty state in spanish', () => {
    const fixture = render()
    TestBed.inject(TranslocoService).setActiveLang('es')
    fixture.detectChanges()

    expect(fixture.nativeElement.textContent).toContain(SCOPE_CATALOGUES.shell.es.trips.emptyTitle)
  })
})
