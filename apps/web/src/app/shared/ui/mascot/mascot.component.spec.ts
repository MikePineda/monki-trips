import { Component, input } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { ACTIVE_MASCOT, type MascotState } from './mascot-sheet'
import { MkMascotComponent, type MascotSize } from './mascot.component'

@Component({
  imports: [MkMascotComponent],
  template: `<mk-mascot [state]="state()" [size]="size()" [label]="label()" [motion]="motion()" />`,
})
class Host {
  readonly state = input<MascotState>('happy')
  readonly size = input<MascotSize>('md')
  readonly label = input<string | undefined>(undefined)
  readonly motion = input<'auto' | 'still'>('auto')
}

/** A `matchMedia` that answers the reduced-motion query and lets the spec flip it. */
function fakeMatchMedia(reduce: boolean) {
  const listeners: ((event: { matches: boolean }) => void)[] = []
  const media = {
    matches: reduce,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => {
      listeners.push(listener)
    },
    removeEventListener: () => undefined,
  }
  return {
    matchMedia: (query: string) => (query === media.media ? media : { ...media, matches: false }),
    flip: (matches: boolean) => listeners.forEach((listener) => listener({ matches })),
  }
}

describe('mk-mascot', () => {
  let fake: ReturnType<typeof fakeMatchMedia>

  beforeEach(() => {
    fake = fakeMatchMedia(false)
    vi.stubGlobal('matchMedia', fake.matchMedia)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function render(
    inputs: Partial<{
      state: MascotState
      size: MascotSize
      label: string
      motion: 'auto' | 'still'
    }> = {}
  ) {
    TestBed.resetTestingModule()
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value)
    }
    fixture.detectChanges()
    return { fixture, mascot: fixture.nativeElement.querySelector('mk-mascot') as HTMLElement }
  }

  it('is decorative without a label and an image with one', () => {
    expect(render().mascot.getAttribute('aria-hidden')).toBe('true')
    expect(render().mascot.getAttribute('role')).toBeNull()

    const { mascot } = render({ label: 'Kiko is happy' })
    expect(mascot.getAttribute('role')).toBe('img')
    expect(mascot.getAttribute('aria-label')).toBe('Kiko is happy')
    expect(mascot.hasAttribute('aria-hidden')).toBe(false)
  })

  it.each<[MascotSize, number]>([
    ['sm', 48],
    ['md', 96],
    ['lg', 160],
  ])('size %s is %i px', (size, px) => {
    const { mascot } = render({ size })

    expect(mascot.getAttribute('data-size')).toBe(size)
    expect(mascot.style.getPropertyValue('--mk-mascot-size')).toBe(`${px}px`)
  })

  it('drives the steps() animation of the state from the sheet through custom properties', () => {
    const { mascot } = render({ state: 'excited', size: 'sm' })
    const excited = ACTIVE_MASCOT.states.excited
    const [col, row] = excited.frames[0]

    expect(mascot.getAttribute('data-state')).toBe('excited')
    expect(mascot.getAttribute('data-motion')).toBe('animated')
    expect(mascot.style.getPropertyValue('--mk-mascot-sheet')).toBe(
      `url("mascot/${ACTIVE_MASCOT.id}/${ACTIVE_MASCOT.sheet}")`
    )
    expect(mascot.style.getPropertyValue('--mk-mascot-frames')).toBe(String(excited.frames.length))
    expect(mascot.style.getPropertyValue('--mk-mascot-cols')).toBe(String(ACTIVE_MASCOT.columns))
    expect(mascot.style.getPropertyValue('--mk-mascot-rows')).toBe(String(ACTIVE_MASCOT.rows))
    expect(mascot.style.getPropertyValue('--mk-mascot-x')).toBe(`${-col * 48}px`)
    expect(mascot.style.getPropertyValue('--mk-mascot-end-x')).toBe(
      `${-(col + excited.frames.length) * 48}px`
    )
    expect(mascot.style.getPropertyValue('--mk-mascot-y')).toBe(`${-row * 48}px`)
    expect(mascot.style.getPropertyValue('--mk-mascot-duration')).toBe(
      `${excited.frames.length / excited.fps}s`
    )
  })

  it('shows the still frame when the device prefers reduced motion, and follows a change', () => {
    fake = fakeMatchMedia(true)
    vi.stubGlobal('matchMedia', fake.matchMedia)
    const { fixture, mascot } = render({ state: 'thinking' })
    const still = ACTIVE_MASCOT.states.thinking.frames[ACTIVE_MASCOT.states.thinking.still]

    expect(mascot.getAttribute('data-motion')).toBe('still')
    expect(mascot.style.getPropertyValue('--mk-mascot-still-x')).toBe(`${-still[0] * 96}px`)

    fake.flip(false)
    fixture.detectChanges()
    expect(mascot.getAttribute('data-motion')).toBe('animated')
  })

  it('motion="still" forces the still frame regardless of the device', () => {
    const { mascot } = render({ motion: 'still' })

    expect(mascot.getAttribute('data-motion')).toBe('still')
  })
})
