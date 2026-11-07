import { TestBed } from '@angular/core/testing'
import { Router, provideRouter } from '@angular/router'
import { RouterTestingHarness } from '@angular/router/testing'
import { i18nTesting } from '../testing/i18n-testing'
import { routes } from './app.routes'

describe('app routes', () => {
  async function navigate(url: string) {
    TestBed.configureTestingModule({
      imports: [i18nTesting()],
      providers: [provideRouter(routes)],
    })
    const harness = await RouterTestingHarness.create()
    await harness.navigateByUrl(url)
    return { harness, router: TestBed.inject(Router) }
  }

  it('the root opens the trip list inside the shell', async () => {
    const { harness, router } = await navigate('/')

    expect(router.url).toBe('/trips')
    expect(harness.routeNativeElement?.querySelector('[data-testid="trips.empty"]')).not.toBeNull()
  })

  it('the style guide is reachable', async () => {
    const { harness } = await navigate('/styleguide')

    expect(
      harness.routeNativeElement?.querySelector('[data-testid="styleguide.tokens"]')
    ).not.toBeNull()
  })

  it('unknown paths fall back to the trip list', async () => {
    const { router } = await navigate('/nowhere')

    expect(router.url).toBe('/trips')
  })
})
