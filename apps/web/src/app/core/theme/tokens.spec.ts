import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `docs/design/tokens.json` is the source of truth of the design system;
 * `src/styles.css` is its only copy in the app. Every colour token must be
 * declared with the same value three times (light on :root, dark under
 * [data-theme='dark'] and under prefers-color-scheme for the no-choice
 * case), and the spacing, radius, elevation and motion tokens once.
 */
const webRoot = process.cwd()
const styles = readFileSync(join(webRoot, 'src/styles.css'), 'utf8')

interface ThemedValue {
  light: string
  dark: string
}
interface Tokens {
  color: { tokens: { name: string; value: ThemedValue }[] }
  spacing: { tokens: { name: string; value: string }[] }
  radius: { tokens: { name: string; value: string }[] }
  shadow: { tokens: { name: string; value: ThemedValue }[] }
  motion: { tokens: { name: string; value: string }[] }
}

const tokens = JSON.parse(
  readFileSync(join(webRoot, '../../docs/design/tokens.json'), 'utf8')
) as Tokens

/** The declarations of the first CSS block whose selector line matches. */
function block(selector: RegExp): Map<string, string> {
  const start = styles.search(selector)
  if (start < 0) {
    throw new Error(`styles.css has no block for ${selector}`)
  }
  const open = styles.indexOf('{', start)
  let depth = 0
  let end = open
  for (; end < styles.length; end++) {
    if (styles[end] === '{') depth++
    if (styles[end] === '}' && --depth === 0) break
  }
  const body = styles.slice(open + 1, end)
  return new Map(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].trim().toLowerCase(),
    ])
  )
}

const light = block(/^:root\s*\{/m)
const darkChoice = block(/^\[data-theme=['"]dark['"]\]\s*\{/m)
const darkDevice = block(/^\s*:root:not\(\[data-theme\]\)\s*\{/m)

describe('tokens.css are in sync with tokens.json', () => {
  it('declares every colour token in light and in both dark rules with the json values', () => {
    expect(tokens.color.tokens.length).toBeGreaterThanOrEqual(40)
    for (const token of tokens.color.tokens) {
      const name = `--${token.name}`
      expect(light.get(name), `${name} light`).toBe(token.value.light.toLowerCase())
      expect(darkChoice.get(name), `${name} dark (choice)`).toBe(token.value.dark.toLowerCase())
      expect(darkDevice.get(name), `${name} dark (device)`).toBe(token.value.dark.toLowerCase())
    }
  })

  it('declares the spacing scale space-half and space-1..8', () => {
    const names = tokens.spacing.tokens.map((token) => token.name)
    expect(names).toEqual([
      'space-half',
      'space-1',
      'space-2',
      'space-3',
      'space-4',
      'space-5',
      'space-6',
      'space-7',
      'space-8',
    ])
    for (const token of tokens.spacing.tokens) {
      expect(light.get(`--${token.name}`), token.name).toBe(token.value)
    }
  })

  it('declares the radii, the motion tokens and both elevation values', () => {
    for (const token of [...tokens.radius.tokens, ...tokens.motion.tokens]) {
      expect(light.get(`--${token.name}`), token.name).toBe(token.value.toLowerCase())
    }
    for (const token of tokens.shadow.tokens) {
      const name = `--${token.name}`
      expect(light.get(name), `${name} light`).toBe(token.value.light.toLowerCase())
      expect(darkChoice.get(name), `${name} dark`).toBe(token.value.dark.toLowerCase())
      expect(darkDevice.get(name), `${name} dark (device)`).toBe(token.value.dark.toLowerCase())
    }
  })

  it('the two dark rules are identical', () => {
    expect([...darkDevice.entries()].sort()).toEqual([...darkChoice.entries()].sort())
  })

  it('self-hosts every font of tokens.json with font-display swap', () => {
    const faces = [...styles.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => match[1])
    const json = JSON.parse(readFileSync(join(webRoot, '../../docs/design/tokens.json'), 'utf8'))
    const fonts = json.type.fonts as { family: string; weight: string; file: string }[]
    expect(faces).toHaveLength(fonts.length)
    for (const font of fonts) {
      const face = faces.find(
        (candidate) =>
          candidate.includes(`'${font.family}'`) &&
          candidate.includes(`font-weight: ${font.weight}`)
      )
      expect(face, `${font.family} ${font.weight}`).toBeDefined()
      expect(face).toContain('font-display: swap')
      expect(face).toContain(`url('/${font.file}')`)
    }
  })
})
