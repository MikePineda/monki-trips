#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// Contrast gate for the design tokens. Pure functions (WCAG 2.x relative
// luminance and contrast ratio) plus a small CLI that reads every
// `docs/design/proposals/*/palette.md` (the table under the "## Tokens"
// heading) and `docs/design/tokens.json` (its `color.tokens` list), and
// checks each token against the surfaces it names, in both themes:
//
//   role `text`       >= 4.5:1  (body copy, labels, links, numbers)
//   role `graphic`    >= 3:1    (icons, meaningful borders, focus rings)
//   role `surface`    no requirement (the backgrounds themselves)
//   role `decorative` no requirement (hairline separators; documented as such)
//   role `series`     no requirement here (chart colours; validated by the
//                     dataviz palette validator, see docs/design/README.md)
//   role `overlay`    no requirement (translucent scrims, `#RRGGBBAA`)
//
// palette.md columns: | Token | Light | Dark | Role | Against |, where Against
// is a comma-separated list of other tokens of the same table (usually
// surfaces). tokens.json entries: `{ name, value: { light, dark } | "#hex",
// role, against?: string[], usage? }`. Exit code 1 on any failure; the report
// names token, surface, theme, ratio and threshold.
//
// Usage: node scripts/check-contrast.mjs [palette.md | tokens.json ...]

import { existsSync, readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { extname } from 'node:path'
import { pathToFileURL } from 'node:url'

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const TOKENS_JSON = 'docs/design/tokens.json'

const RATIO_BY_ROLE = Object.freeze({
  text: 4.5,
  graphic: 3,
  surface: 0,
  decorative: 0,
  series: 0,
  overlay: 0,
})

/** Expands `#abc` to `#aabbcc` and validates the input; `#rrggbbaa` is kept as is. */
function normaliseHex(hex) {
  if (typeof hex !== 'string' || !HEX.test(hex.trim())) {
    throw new TypeError(`not a hex colour: ${String(hex)}`)
  }
  const digits = hex.trim().slice(1)
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits
  return `#${full.toUpperCase()}`
}

function channel(value) {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG 2.x relative luminance of an opaque sRGB hex colour, 0 (black) to 1 (white). */
export function relativeLuminance(hex) {
  const full = normaliseHex(hex)
  if (full.length === 9) {
    throw new TypeError(`translucent colour has no contrast on its own: ${full}`)
  }
  const r = parseInt(full.slice(1, 3), 16)
  const g = parseInt(full.slice(3, 5), 16)
  const b = parseInt(full.slice(5, 7), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2.x contrast ratio between two colours, 1 to 21, order independent. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [light, dark] = la >= lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/** Minimum ratio for a role; throws on an unknown role. */
export function requiredRatio(role) {
  if (!Object.hasOwn(RATIO_BY_ROLE, role)) {
    throw new Error(`unknown role "${role}" (expected ${Object.keys(RATIO_BY_ROLE).join(', ')})`)
  }
  return RATIO_BY_ROLE[role]
}

/**
 * Reads the token table that follows the "## Tokens" heading of a palette.md.
 * Returns `[{ name, light, dark, role, against: string[] }]`.
 */
export function parsePalette(markdown) {
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((line) => /^##\s+Tokens\s*$/.test(line))
  if (start === -1) throw new Error('palette.md has no "## Tokens" heading')

  const tokens = []
  let inTable = false
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break
    const isRow = /^\s*\|/.test(line)
    if (!isRow) {
      if (inTable) break
      continue
    }
    inTable = true
    const cells = line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim())
    if (cells.length < 5) throw new Error(`token row needs 5 columns: ${line}`)
    const [name, light, dark, role, against] = cells
    if (/^-+$/.test(name) || /^Token$/i.test(name)) continue
    tokens.push({
      name,
      light: normaliseHex(light),
      dark: normaliseHex(dark),
      role,
      against: against
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    })
  }
  if (tokens.length === 0) throw new Error('the Tokens table is empty')
  return tokens
}

/**
 * Reads the `color.tokens` list of a tokens.json (the Design System shape plus
 * `role` and `against`). Returns `[{ name, light, dark, role, against: string[] }]`.
 */
export function parseTokensJson(text) {
  const data = JSON.parse(text)
  const list = data?.color?.tokens
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('tokens.json has no color.tokens list')
  }
  return list.map((token) => {
    if (typeof token.role !== 'string') throw new Error(`token "${token.name}" has no role`)
    const value =
      typeof token.value === 'string' ? { light: token.value, dark: token.value } : token.value
    return {
      name: token.name,
      light: normaliseHex(value.light),
      dark: normaliseHex(value.dark ?? value.light),
      role: token.role,
      against: Array.isArray(token.against) ? [...token.against] : [],
    }
  })
}

/** Parses a token file by its extension: `.md` (palette table) or `.json` (tokens.json). */
export function loadTokens(file, text) {
  const ext = extname(file).toLowerCase()
  if (ext === '.md') return parsePalette(text)
  if (ext === '.json') return parseTokensJson(text)
  throw new Error(`${file}: expected a .md or .json token file`)
}

/**
 * Checks every token against each surface it names, in both themes.
 * Returns the failures: `[{ theme, token, against, ratio, required }]`.
 */
export function checkPalette(tokens) {
  const byName = new Map(tokens.map((t) => [t.name, t]))
  const findings = []
  for (const token of tokens) {
    const required = requiredRatio(token.role)
    if (required > 0 && token.against.length === 0) {
      throw new Error(`token "${token.name}" (${token.role}) names nothing in "against"`)
    }
    for (const surfaceName of token.against) {
      const surface = byName.get(surfaceName)
      if (!surface)
        throw new Error(`token "${token.name}" is checked against unknown "${surfaceName}"`)
      for (const theme of ['light', 'dark']) {
        const ratio = contrastRatio(token[theme], surface[theme])
        if (ratio < required) {
          findings.push({ theme, token: token.name, against: surfaceName, ratio, required })
        }
      }
    }
  }
  return findings
}

function formatRatio(ratio) {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`
}

/** Default inputs: every proposal's palette.md plus the system's tokens.json. */
function defaultFiles() {
  const files = globSync('docs/design/proposals/*/palette.md').sort()
  if (existsSync(TOKENS_JSON)) files.push(TOKENS_JSON)
  return files
}

/** CLI: checks the given token files (default: every proposal and tokens.json). */
export function main(argv) {
  const files = argv.length > 0 ? argv : defaultFiles()
  if (files.length === 0) {
    console.error('check-contrast: no palette.md or tokens.json found')
    return 2
  }
  let failures = 0
  for (const file of files) {
    const tokens = loadTokens(file, readFileSync(file, 'utf8'))
    const findings = checkPalette(tokens)
    const pairs = tokens.reduce((n, t) => n + t.against.length * 2, 0)
    if (findings.length === 0) {
      console.log(`ok    ${file}: ${tokens.length} tokens, ${pairs} pairs checked`)
      continue
    }
    failures += findings.length
    console.log(`FAIL  ${file}: ${findings.length} of ${pairs} pairs below threshold`)
    for (const f of findings) {
      console.log(
        `      ${f.theme.padEnd(5)} ${f.token} on ${f.against}: ${formatRatio(f.ratio)} < ${f.required}:1`
      )
    }
  }
  return failures === 0 ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2))
}
