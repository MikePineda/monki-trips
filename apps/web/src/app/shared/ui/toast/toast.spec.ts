import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { MkToastHostComponent } from './toast-host.component'
import { TOAST_DURATION_MS, TOAST_WITH_ACTION_DURATION_MS, ToastService } from './toast.service'

describe('mk-toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    TestBed.configureTestingModule({ imports: [MkToastHostComponent, i18nTesting()] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function render() {
    const fixture = TestBed.createComponent(MkToastHostComponent)
    fixture.detectChanges()
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      service: TestBed.inject(ToastService),
      toasts: () => [...host.querySelectorAll('[data-testid="ui.toast"]')] as HTMLElement[],
    }
  }

  it('shows a message as a status and dismisses it after five seconds', () => {
    const { fixture, service, toasts } = render()

    service.show({ message: 'Expense saved' })
    fixture.detectChanges()

    expect(toasts()).toHaveLength(1)
    expect(toasts()[0].getAttribute('role')).toBe('status')
    expect(toasts()[0].textContent).toContain('Expense saved')

    vi.advanceTimersByTime(TOAST_DURATION_MS)
    fixture.detectChanges()
    expect(toasts()).toHaveLength(0)
  })

  it('an undo toast offers the translated Undo, runs it once and goes away', () => {
    const { fixture, service, toasts } = render()
    const undo = vi.fn()

    service.showUndo('Expense deleted', undo)
    fixture.detectChanges()
    const action = toasts()[0].querySelector('[data-testid="ui.toast.action"]') as HTMLButtonElement

    expect(action.textContent?.trim()).toBe('Undo')
    action.click()
    fixture.detectChanges()

    expect(undo).toHaveBeenCalledTimes(1)
    expect(toasts()).toHaveLength(0)
    vi.advanceTimersByTime(TOAST_WITH_ACTION_DURATION_MS)
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('a toast with an action stays longer than a plain one', () => {
    const { service } = render()

    service.show({ message: 'Saved', action: { label: 'View', run: () => undefined } })
    vi.advanceTimersByTime(TOAST_DURATION_MS)

    expect(service.toasts()).toHaveLength(1)
    vi.advanceTimersByTime(TOAST_WITH_ACTION_DURATION_MS - TOAST_DURATION_MS)
    expect(service.toasts()).toHaveLength(0)
  })

  it('a persistent toast stays until dismissed by hand', () => {
    const { fixture, service, toasts } = render()

    service.show({ message: 'New version available', persistent: true })
    vi.advanceTimersByTime(60_000)
    fixture.detectChanges()
    expect(toasts()).toHaveLength(1)

    const dismiss = toasts()[0].querySelector(
      '[data-testid="ui.toast.dismiss"]'
    ) as HTMLButtonElement
    expect(dismiss.getAttribute('aria-label')).toBe('Dismiss')
    dismiss.click()
    fixture.detectChanges()

    expect(toasts()).toHaveLength(0)
  })

  it('the handle dismisses its own toast', () => {
    const { service } = render()
    const handle = service.show({ message: 'One' })
    service.show({ message: 'Two' })

    handle.dismiss()

    expect(service.toasts().map((toast) => toast.message)).toEqual(['Two'])
  })
})
