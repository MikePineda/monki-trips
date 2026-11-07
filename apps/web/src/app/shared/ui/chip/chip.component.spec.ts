import { Component, input, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkChipComponent } from './chip.component'

@Component({
  imports: [MkChipComponent],
  template: `
    <mk-chip [selectable]="selectable()" [disabled]="disabled()" [(selected)]="selected">
      Food
    </mk-chip>
  `,
})
class Host {
  readonly selectable = input(false)
  readonly disabled = input(false)
  readonly selected = signal(false)
}

describe('mk-chip', () => {
  function render(inputs: Partial<{ selectable: boolean; disabled: boolean }> = {}) {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value)
    }
    fixture.detectChanges()
    return fixture
  }

  it('is a static tag by default: no button, no pressed state', () => {
    const fixture = render()

    expect(fixture.nativeElement.querySelector('button')).toBeNull()
    expect(fixture.nativeElement.textContent?.trim()).toBe('Food')
  })

  it('selectable chips toggle and report through aria-pressed', () => {
    const fixture = render({ selectable: true })
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement

    expect(button.getAttribute('aria-pressed')).toBe('false')
    button.click()
    fixture.detectChanges()

    expect(fixture.componentInstance.selected()).toBe(true)
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })

  it('a disabled selectable chip does not toggle', () => {
    const fixture = render({ selectable: true, disabled: true })
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement

    expect(button.disabled).toBe(true)
    button.click()
    fixture.detectChanges()

    expect(fixture.componentInstance.selected()).toBe(false)
  })
})
