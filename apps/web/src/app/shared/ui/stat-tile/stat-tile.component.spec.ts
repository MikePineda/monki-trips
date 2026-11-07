import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkRowComponent } from '../layout/row.component'
import { MkStatTileComponent } from './stat-tile.component'

@Component({
  imports: [MkRowComponent, MkStatTileComponent],
  template: `
    <mk-row align="stretch" gap="0">
      <mk-stat-tile eyebrow="Left today" value="€84" sub="A$138" />
      <mk-stat-tile eyebrow="Spent" value="−€18" sub="over budget" />
      <mk-stat-tile eyebrow="Pending" value="1" />
    </mk-row>
  `,
})
class Host {}

describe('mk-stat-tile', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('sets the eyebrow in mono caps, the value in title and the sub-line in caption', () => {
    const host = render()
    const tiles = host.querySelectorAll('mk-stat-tile')

    expect(tiles).toHaveLength(3)
    expect(tiles[0].querySelector('.mk-stat__eyebrow')?.classList.contains('mk-type-eyebrow')).toBe(
      true
    )
    expect(tiles[0].querySelector('.mk-stat__value')?.textContent).toBe('€84')
    expect(tiles[0].querySelector('.mk-stat__value')?.classList.contains('mk-type-title')).toBe(
      true
    )
    expect(tiles[0].querySelector('.mk-stat__sub')?.textContent).toBe('A$138')
    expect(tiles[1].querySelector('.mk-stat__value')?.textContent).toBe('−€18')
    expect(tiles[2].querySelector('.mk-stat__sub')).toBeNull()
  })
})
