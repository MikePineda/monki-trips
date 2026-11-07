// SPDX-License-Identifier: AGPL-3.0-only
// Spec for scripts/check-contrast.mjs: WCAG 2 contrast over a palette.md token table
// or the color tokens of docs/design/tokens.json.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  checkPalette,
  contrastRatio,
  loadTokens,
  parsePalette,
  parseTokensJson,
  relativeLuminance,
  requiredRatio,
} from './check-contrast.mjs'

const SAMPLE = `# Sample palette

Some prose before the table.

## Tokens

| Token      | Light   | Dark    | Role       | Against             |
| ---------- | ------- | ------- | ---------- | ------------------- |
| surface-0  | #FFFFFF | #000000 | surface    |                     |
| surface-1  | #F4F4F4 | #111111 | surface    |                     |
| ink-1      | #000000 | #FFFFFF | text       | surface-0, surface-1 |
| ink-3      | #777777 | #888888 | text       | surface-0           |
| accent     | #0000EE | #99BBFF | graphic    | surface-0           |
| line       | #DDDDDD | #333333 | decorative |                     |

## Mascot palette

| Token | Light | Dark | Role | Against |
| ----- | ----- | ----- | ---- | ------- |
| fur   | #8B5A2B | #8B5A2B | ignored | surface-0 |
`

test('relative_luminance_of_black_is_zero_and_white_is_one', () => {
  assert.equal(relativeLuminance('#000000'), 0)
  assert.equal(relativeLuminance('#FFFFFF'), 1)
})

test('relative_luminance_accepts_lowercase_and_three_digit_hex', () => {
  assert.equal(relativeLuminance('#fff'), 1)
  assert.ok(Math.abs(relativeLuminance('#808080') - 0.2159) < 0.001)
})

test('relative_luminance_rejects_anything_that_is_not_a_hex_colour', () => {
  assert.throws(() => relativeLuminance('red'), /hex/)
  assert.throws(() => relativeLuminance('#12345'), /hex/)
})

test('contrast_ratio_of_black_on_white_is_21_and_symmetric', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21)
  assert.equal(contrastRatio('#FFFFFF', '#000000'), 21)
  assert.equal(contrastRatio('#808080', '#808080'), 1)
})

test('required_ratio_is_4_5_for_text_3_for_graphics_and_none_otherwise', () => {
  assert.equal(requiredRatio('text'), 4.5)
  assert.equal(requiredRatio('graphic'), 3)
  assert.equal(requiredRatio('surface'), 0)
  assert.equal(requiredRatio('decorative'), 0)
})

test('parse_palette_reads_only_the_table_under_the_tokens_heading', () => {
  const tokens = parsePalette(SAMPLE)
  assert.deepEqual(
    tokens.map((t) => t.name),
    ['surface-0', 'surface-1', 'ink-1', 'ink-3', 'accent', 'line']
  )
  assert.deepEqual(tokens[2], {
    name: 'ink-1',
    light: '#000000',
    dark: '#FFFFFF',
    role: 'text',
    against: ['surface-0', 'surface-1'],
  })
  assert.deepEqual(tokens[0].against, [])
})

test('parse_palette_fails_without_a_tokens_table', () => {
  assert.throws(() => parsePalette('# Nothing here\n'), /Tokens/)
})

test('check_palette_reports_every_pair_below_its_threshold_in_both_themes', () => {
  const findings = checkPalette(parsePalette(SAMPLE))
  // ink-3 #777777 on white is 4.48:1 (fails text), #888888 on black is 5.9:1 (passes).
  // accent #0000EE on white is 9.4:1 (passes graphic); #99BBFF on black is 11.2:1 (passes).
  assert.deepEqual(
    findings.map((f) => `${f.theme}:${f.token}/${f.against}`),
    ['light:ink-3/surface-0']
  )
  assert.equal(findings[0].required, 4.5)
  assert.ok(findings[0].ratio < 4.5 && findings[0].ratio > 4.4)
})

test('check_palette_fails_on_an_unknown_against_token_or_role', () => {
  assert.throws(
    () =>
      checkPalette([
        { name: 'ink-1', light: '#000', dark: '#FFF', role: 'text', against: ['nowhere'] },
      ]),
    /nowhere/
  )
  assert.throws(
    () =>
      checkPalette([{ name: 'ink-1', light: '#000', dark: '#FFF', role: 'fancy', against: [] }]),
    /role/
  )
})

test('check_palette_requires_text_and_graphic_tokens_to_name_a_surface', () => {
  assert.throws(
    () => checkPalette([{ name: 'ink-1', light: '#000', dark: '#FFF', role: 'text', against: [] }]),
    /against/
  )
})

test('check_palette_passes_a_clean_palette', () => {
  const tokens = parsePalette(SAMPLE).filter((t) => t.name !== 'ink-3')
  assert.deepEqual(checkPalette(tokens), [])
})

const TOKENS_JSON = JSON.stringify({
  name: 'Sample',
  color: {
    themes: [
      { id: 'light', name: 'Light' },
      { id: 'dark', name: 'Dark' },
    ],
    tokens: [
      { name: 'surface-0', value: { light: '#FFFFFF', dark: '#000000' }, role: 'surface' },
      {
        name: 'ink-1',
        value: { light: '#000000', dark: '#FFFFFF' },
        role: 'text',
        against: ['surface-0'],
        usage: 'Primary text.',
      },
      { name: 'series-1', value: { light: '#2a78d6', dark: '#3987e5' }, role: 'series' },
      { name: 'scrim', value: { light: '#1114174D', dark: '#000000A3' }, role: 'overlay' },
      { name: 'same', value: '#777777', role: 'decorative' },
    ],
  },
})

test('required_ratio_is_none_for_series_and_overlay_tokens', () => {
  assert.equal(requiredRatio('series'), 0)
  assert.equal(requiredRatio('overlay'), 0)
})

test('parse_tokens_json_reads_every_color_token_with_role_and_against', () => {
  const tokens = parseTokensJson(TOKENS_JSON)
  assert.deepEqual(
    tokens.map((t) => t.name),
    ['surface-0', 'ink-1', 'series-1', 'scrim', 'same']
  )
  assert.deepEqual(tokens[1], {
    name: 'ink-1',
    light: '#000000',
    dark: '#FFFFFF',
    role: 'text',
    against: ['surface-0'],
  })
  assert.deepEqual(tokens[0].against, [])
  assert.equal(tokens[3].light, '#1114174D')
})

test('parse_tokens_json_uses_a_plain_string_value_for_both_themes', () => {
  const same = parseTokensJson(TOKENS_JSON).find((t) => t.name === 'same')
  assert.equal(same.light, '#777777')
  assert.equal(same.dark, '#777777')
})

test('parse_tokens_json_fails_without_color_tokens_or_a_role', () => {
  assert.throws(() => parseTokensJson('{"name":"x"}'), /color\.tokens/)
  const noRole = JSON.stringify({ color: { tokens: [{ name: 'a', value: '#000' }] } })
  assert.throws(() => parseTokensJson(noRole), /role/)
})

test('check_palette_passes_a_tokens_json_with_translucent_overlays', () => {
  assert.deepEqual(checkPalette(parseTokensJson(TOKENS_JSON)), [])
})

test('contrast_is_refused_for_a_translucent_colour', () => {
  assert.throws(() => contrastRatio('#00000080', '#FFFFFF'), /translucent/)
  const tokens = [
    { name: 'surface-0', light: '#FFF', dark: '#000', role: 'surface', against: [] },
    { name: 'ink-1', light: '#00000080', dark: '#FFF', role: 'text', against: ['surface-0'] },
  ]
  assert.throws(() => checkPalette(tokens), /translucent/)
})

test('load_tokens_dispatches_on_the_file_extension', () => {
  assert.equal(loadTokens('a/palette.md', SAMPLE).length, 6)
  assert.equal(loadTokens('a/tokens.json', TOKENS_JSON).length, 5)
  assert.throws(() => loadTokens('a/tokens.yaml', ''), /\.md or \.json/)
})
