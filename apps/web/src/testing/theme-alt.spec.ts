import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { MockItineraryDayComponent } from '../app/features/styleguide/mocks/itinerary-day.mock'
import { MockQuickExpenseComponent } from '../app/features/styleguide/mocks/quick-expense.mock'
import { MockTodayComponent } from '../app/features/styleguide/mocks/today.mock'
import { MockTripsComponent } from '../app/features/styleguide/mocks/trips.mock'
import { i18nTesting } from './i18n-testing'

/**
 * Theme = tokens. The four mock screens are mounted with the alternative
 * theme of theme-alt.css, and every colour-bearing declaration of the
 * component styles the mount brings into the document is checked: its
 * value must resolve through a custom property that the theme declares
 * (or be transparent / currentColor / inherit / none). Then the swap is
 * complete and no hardcoded value leaks: a re-skin is the token file.
 */
@Component({
  imports: [
    MockTodayComponent,
    MockTripsComponent,
    MockItineraryDayComponent,
    MockQuickExpenseComponent,
  ],
  template: `
    <app-mock-today />
    <app-mock-trips />
    <app-mock-itinerary-day />
    <app-mock-quick-expense />
  `,
})
class Screens {}

const COLOUR_PROPERTIES =
  /^(?:color|background(?:-color)?|border(?:-[a-z]+)?(?:-color)?|outline(?:-color)?|fill|stroke|box-shadow|mask|border-radius|border-top-left-radius|border-top-right-radius)$/
/** Value parts that carry no colour, radius or shadow of their own. */
const NEUTRAL_PART =
  /^(?:transparent|currentcolor|inherit|none|0|initial|solid|dashed|\d+(?:\.\d+)?px|center|contain|no-repeat|\/)$/i

/** True when, once the neutral parts are removed, nothing but var() references is left. */
function onlyTokens(value: string): boolean {
  const rest = value
    .replace(/var\((--[\w-]+)[^)]*\)/g, ' ')
    .replace(/calc\([^)]*\)/g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean)
    .filter((part) => !NEUTRAL_PART.test(part))
  return rest.length === 0
}

function themeTokens(): Set<string> {
  const css = readFileSync(join(process.cwd(), 'src/testing/theme-alt.css'), 'utf8')
  return new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]))
}

/** `property: value` pairs of every <style> the mount added to the document. */
function mountedDeclarations(): { property: string; value: string }[] {
  const declarations: { property: string; value: string }[] = []
  for (const style of document.querySelectorAll('style')) {
    const text = style.textContent ?? ''
    for (const rule of text.matchAll(/\{([^{}]*)\}/g)) {
      for (const declaration of rule[1].split(';')) {
        const colon = declaration.indexOf(':')
        if (colon < 0) continue
        const property = declaration.slice(0, colon).trim()
        const value = declaration.slice(colon + 1).trim()
        if (COLOUR_PROPERTIES.test(property)) {
          declarations.push({ property, value })
        }
      }
    }
  }
  return declarations
}

/** Custom properties a value refers to through var(). */
function referencedTokens(value: string): string[] {
  return [...value.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1])
}

describe('theme-alt: the mock screens re-skin through tokens only', () => {
  let tokens: Set<string>

  beforeEach(() => {
    tokens = themeTokens()
    const alt = document.createElement('style')
    alt.id = 'theme-alt'
    alt.textContent = readFileSync(join(process.cwd(), 'src/testing/theme-alt.css'), 'utf8')
    document.head.append(alt)
    TestBed.configureTestingModule({
      imports: [Screens, i18nTesting()],
      providers: [provideRouter([])],
    })
  })

  afterEach(() => {
    document.getElementById('theme-alt')?.remove()
  })

  it('declares every token of styles.css, with different surfaces, ink, accent and radii', () => {
    const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8')
    const root = /^:root\s*\{([\s\S]*?)^\}/m.exec(styles)?.[1] ?? ''
    const expected = [...root.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1])
    const missing = expected.filter((token) => !tokens.has(token))

    expect(expected.length).toBeGreaterThan(50)
    expect(missing).toEqual([])
    const value = (token: string) =>
      /:root\s*\{([\s\S]*?)^\}/m.exec(styles)?.[1].match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]
    const alt = readFileSync(join(process.cwd(), 'src/testing/theme-alt.css'), 'utf8')
    const altValue = (token: string) => alt.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]
    for (const token of ['--surface-0', '--ink-1', '--accent', '--radius-md']) {
      expect(altValue(token), token).not.toBe(value(token))
    }
  })

  it('every colour, radius and shadow the mounted components declare resolves to a theme token', () => {
    const fixture = TestBed.createComponent(Screens)
    fixture.detectChanges()
    const host = fixture.nativeElement as HTMLElement

    expect(host.querySelectorAll('mk-device-frame')).toHaveLength(4)
    expect(host.querySelectorAll('[class*="mk-"], mk-ticket, mk-mascot').length).toBeGreaterThan(50)

    const declarations = mountedDeclarations()
    expect(declarations.length).toBeGreaterThan(50)

    const leaks = declarations
      .filter(({ value }) => {
        if (!onlyTokens(value)) {
          return true
        }
        // Every var() must be a theme token; component-private --mk-* properties are set from inputs, not colours.
        return referencedTokens(value).some(
          (token) => !tokens.has(token) && !token.startsWith('--mk-')
        )
      })
      .map(({ property, value }) => `${property}: ${value}`)

    expect(leaks).toEqual([])
  })
})
