import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkStatRowComponent } from './stat-row.component'
import { MkStatTileComponent } from './stat-tile.component'

/** Three long money values in a 300 px column: what a narrow phone shows on Money. */
@Component({
  imports: [MkStatRowComponent, MkStatTileComponent],
  styles: `
    .narrow {
      width: 300px;
    }
  `,
  template: `
    <div class="narrow">
      <mk-stat-row data-testid="probe.stats">
        <mk-stat-tile eyebrow="Spent" value="A$3,175.48" sub="of A$7,948.60" />
        <mk-stat-tile eyebrow="Remaining" value="A$4,773.12" />
        <mk-stat-tile eyebrow="Per day" value="A$265.17" sub="over 18 trip days" />
      </mk-stat-row>
    </div>
  `,
})
class Host {}

describe('mk-stat-row', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  function style(element: Element): CSSStyleDeclaration {
    return getComputedStyle(element)
  }

  it('is the container its tiles size against and wraps them instead of overlapping', () => {
    const host = render()
    const row = host.querySelector('mk-stat-row')!
    const tiles = row.querySelector('.mk-stat-row__tiles')!

    expect(row.classList.contains('mk-stat-row')).toBe(true)
    expect(style(row).getPropertyValue('container-type')).toBe('inline-size')
    expect(style(tiles).display).toBe('flex')
    expect(style(tiles).flexWrap).toBe('wrap')
    expect(tiles.querySelectorAll('mk-stat-tile')).toHaveLength(3)
  })

  it('keeps every amount whole in tabular figures: no ellipsis, no clipping, no line break', () => {
    const host = render()
    const values = [...host.querySelectorAll('.mk-stat__value')]

    expect(values.map((value) => value.textContent)).toEqual([
      'A$3,175.48',
      'A$4,773.12',
      'A$265.17',
    ])
    for (const value of values) {
      expect(style(value).whiteSpace).toBe('nowrap')
      expect(style(value).textOverflow).not.toBe('ellipsis')
      expect(style(value).overflow).not.toBe('hidden')
      expect(style(value).fontVariantNumeric).toBe('tabular-nums')
    }
  })

  it('a tile grows from its own content width, so a long value moves to the next line', () => {
    const host = render()
    const tile = host.querySelector('mk-stat-tile')!

    expect(style(tile).flexGrow).toBe('1')
    expect(style(tile).flexBasis).toBe('auto')
  })
})
