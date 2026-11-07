#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// Renders the design proposals for a phone review: every
// `docs/design/proposals/<direction>/today-{light,dark}.html` and every
// `docs/design/mascots/<id>/concept.svg` becomes a PNG at 390×844, DPR 3,
// in `docs/design/review/<round>/`, plus a contact sheet (`index.png`) and
// an `index.md` that lists them.
//
// The proposals must work offline: any request that is not `file://` is
// aborted, recorded and makes the script exit 1. The browser is the Chrome
// at `CHROME_PATH` when set (cloud sessions have Chrome for Testing there and
// never run `playwright install`); otherwise Playwright's own Chromium.
//
// Usage: node scripts/design-shots.mjs            # round-1
//        DESIGN_ROUND=round-2 node scripts/design-shots.mjs

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { chromium } from 'playwright'

const ROUND = process.env.DESIGN_ROUND ?? 'round-1'
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PROPOSALS = join(ROOT, 'docs/design/proposals')
const MASCOTS = join(ROOT, 'docs/design/mascots')
const OUT = join(ROOT, 'docs/design/review', ROUND)
const PHONE = { width: 390, height: 844 }
const THEMES = ['light', 'dark']

/** Everything to render, in review order: directions first, then mascots. */
function collectShots() {
  const shots = []
  for (const direction of readdirSync(PROPOSALS, { withFileTypes: true })) {
    if (!direction.isDirectory() || direction.name === 'fonts') continue
    for (const theme of THEMES) {
      const source = join(PROPOSALS, direction.name, `today-${theme}.html`)
      if (!existsSync(source)) throw new Error(`missing proposal: ${source}`)
      shots.push({
        kind: 'direction',
        label: `${direction.name} · ${theme}`,
        file: `${direction.name}-${theme}.png`,
        source,
        colorScheme: theme,
      })
    }
  }
  for (const mascot of readdirSync(MASCOTS, { withFileTypes: true })) {
    if (!mascot.isDirectory()) continue
    const source = join(MASCOTS, mascot.name, 'concept.svg')
    if (!existsSync(source)) throw new Error(`missing mascot concept: ${source}`)
    shots.push({
      kind: 'mascot',
      label: `mascot · ${mascot.name}`,
      file: `mascot-${mascot.name}.png`,
      source,
      colorScheme: 'light',
    })
  }
  if (shots.length === 0) throw new Error('nothing to render')
  return shots
}

/** Aborts every request that is not file://, keeping a list for the report. */
async function sealOffline(context, blocked) {
  await context.route(
    () => true,
    (route) => {
      const url = route.request().url()
      if (url.startsWith('file://')) return route.continue()
      blocked.push(url)
      return route.abort('blockedbyclient')
    }
  )
}

async function renderPage(
  browser,
  blocked,
  url,
  path,
  { colorScheme, deviceScaleFactor, viewport, fullPage }
) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    colorScheme,
    reducedMotion: 'reduce',
    locale: 'en-AU',
  })
  await sealOffline(context, blocked)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(url, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path, fullPage })
  await context.close()
  return errors
}

function contactSheetHtml(shots) {
  const figures = shots
    .map(
      (shot) => `<figure>
  <img src="${pathToFileURL(join(OUT, shot.file)).href}" width="390" height="844" alt="${shot.label}">
  <figcaption>${shot.label}</figcaption>
</figure>`
    )
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Design review ${ROUND}</title>
<style>
  body { margin: 0; padding: 24px; background: #E4E4E0; color: #16161A; font: 500 16px/1.3 system-ui, sans-serif; }
  h1 { margin: 0 0 16px; font-size: 20px; }
  main { display: grid; grid-template-columns: repeat(3, 390px); gap: 24px; }
  figure { margin: 0; }
  img { display: block; width: 390px; height: 844px; outline: 1px solid #85858F; }
  figcaption { margin-top: 8px; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<h1>monki-trips · design review · ${ROUND}</h1>
<main>
${figures}
</main>
</body>
</html>
`
}

function indexMarkdown(shots) {
  const directions = shots.filter((s) => s.kind === 'direction')
  const mascots = shots.filter((s) => s.kind === 'mascot')
  const list = (items) => items.map((s) => `- \`${s.file}\` · ${s.label}`).join('\n')
  return `# Design review · ${ROUND}

Rendered by \`scripts/design-shots.mjs\` at 390×844, DPR 3, with every
non-\`file://\` request blocked. \`index.png\` is the contact sheet.

## Directions

${list(directions)}

## Mascots

${list(mascots)}

## Contact sheet

![All renders](index.png)
`
}

async function main() {
  const shots = collectShots()
  mkdirSync(OUT, { recursive: true })
  const executablePath = process.env.CHROME_PATH
  const browser = await chromium.launch(executablePath ? { executablePath } : {})
  const blocked = []
  const pageErrors = []
  try {
    for (const shot of shots) {
      const errors = await renderPage(
        browser,
        blocked,
        pathToFileURL(shot.source).href,
        join(OUT, shot.file),
        {
          colorScheme: shot.colorScheme,
          deviceScaleFactor: 3,
          viewport: PHONE,
          fullPage: false,
        }
      )
      pageErrors.push(...errors.map((e) => `${shot.file}: ${e}`))
      console.log(`shot  ${shot.file}`)
    }

    const scratch = mkdtempSync(join(tmpdir(), 'design-shots-'))
    try {
      const sheet = join(scratch, 'index.html')
      writeFileSync(sheet, contactSheetHtml(shots))
      await renderPage(browser, blocked, pathToFileURL(sheet).href, join(OUT, 'index.png'), {
        colorScheme: 'light',
        deviceScaleFactor: 1,
        viewport: { width: 3 * 390 + 2 * 24 + 2 * 24, height: 900 },
        fullPage: true,
      })
      console.log('sheet index.png')
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
    writeFileSync(join(OUT, 'index.md'), indexMarkdown(shots))
    console.log('index index.md')
  } finally {
    await browser.close()
  }

  console.log(`blocked requests: ${blocked.length}`)
  for (const url of blocked) console.log(`  ${url}`)
  for (const error of pageErrors) console.log(`page error: ${error}`)
  return blocked.length === 0 && pageErrors.length === 0 ? 0 : 1
}

process.exitCode = await main()
