import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkTextComponent, TEXT_VARIANTS } from './text.component'

@Component({
  imports: [MkTextComponent],
  template: `
    <h1 mk-text variant="title" data-testid="probe.title">Day 4 of 12</h1>
    <p
      mk-text
      variant="caption"
      tone="ink-3"
      align="center"
      [truncate]="true"
      data-testid="probe.caption"
    >
      Updated 3 h ago
    </p>
    <span mk-text data-testid="probe.default">body</span>
  `,
})
class Host {}

describe('mk-text', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('keeps the semantic element and applies the type-scale class of its variant', () => {
    const host = render()
    const title = host.querySelector('[data-testid="probe.title"]')!

    expect(title.tagName).toBe('H1')
    expect(title.classList.contains('mk-type-title')).toBe(true)
    expect(title.getAttribute('data-tone')).toBe('ink-1')
  })

  it('exposes tone, alignment and truncation as data attributes', () => {
    const host = render()
    const caption = host.querySelector('[data-testid="probe.caption"]')!

    expect(caption.classList.contains('mk-type-caption')).toBe(true)
    expect(caption.getAttribute('data-tone')).toBe('ink-3')
    expect(caption.getAttribute('data-align')).toBe('center')
    expect(caption.hasAttribute('data-truncate')).toBe(true)
  })

  it('defaults to body text in ink-1', () => {
    const host = render()
    const span = host.querySelector('[data-testid="probe.default"]')!

    expect(span.classList.contains('mk-type-body')).toBe(true)
  })

  it('names the eleven styles of the design system', () => {
    expect([...TEXT_VARIANTS]).toEqual([
      'display',
      'title',
      'heading',
      'body',
      'body-strong',
      'label',
      'caption',
      'code-display',
      'code',
      'code-label',
      'eyebrow',
    ])
  })
})
