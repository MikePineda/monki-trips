import { Component, input, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import type { IconName } from '../icon/icon-names'
import { MkChipComponent, type ChipTone, type ChipVariant } from './chip.component'

@Component({
  imports: [MkChipComponent],
  template: `
    <mk-chip
      [variant]="variant()"
      [tone]="tone()"
      [icon]="icon()"
      [selectable]="selectable()"
      [disabled]="disabled()"
      [(selected)]="selected"
    >
      Food
    </mk-chip>
  `,
})
class Host {
  readonly variant = input<ChipVariant>('filter')
  readonly tone = input<ChipTone>('neutral')
  readonly icon = input<IconName | undefined>(undefined)
  readonly selectable = input(false)
  readonly disabled = input(false)
  readonly selected = signal(false)
}

describe('mk-chip', () => {
  function render(
    inputs: Partial<{
      variant: ChipVariant
      tone: ChipTone
      icon: IconName
      selectable: boolean
      disabled: boolean
    }> = {}
  ) {
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
    expect(button.textContent?.trim()).toBe('Food')
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

  it('a status chip carries its icon in the status colour and the word in ink', () => {
    const fixture = render({ variant: 'status', tone: 'good', icon: 'circle-check' })
    const chip = fixture.nativeElement.querySelector('mk-chip') as HTMLElement

    expect(chip.getAttribute('data-variant')).toBe('status')
    expect(chip.getAttribute('data-tone')).toBe('good')
    expect(chip.querySelector('mk-icon use')?.getAttribute('href')).toBe(
      'sprite/lucide.svg#circle-check'
    )
    expect(chip.querySelector('.mk-chip__body')?.classList.contains('mk-type-label')).toBe(true)
  })
})
