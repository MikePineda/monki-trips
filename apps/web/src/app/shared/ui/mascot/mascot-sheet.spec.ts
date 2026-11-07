import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { MASCOT_STATES, type MascotSheet } from './mascot-sheet'

/**
 * Every mascot under public/mascot/<id>/ honours the asset contract of
 * docs/PLAN.md: sheet.json (version 1, 64 × 64 frames, render mode, the six
 * states with frames inside the sheet, fps 1–12, a valid still frame), the
 * sheet image next to it, a LICENSE.md that states the art is original, and
 * public/mascot/active.json names one of them. mk-mascot animates with one
 * CSS steps() run, so a state's frames sit on one row, side by side.
 */
const mascotRoot = join(process.cwd(), 'public/mascot')

const ids = readdirSync(mascotRoot).filter((entry) =>
  statSync(join(mascotRoot, entry)).isDirectory()
)

/** Width and height of the sheet image in frame units. */
function sheetSize(dir: string, file: string, frame: { w: number; h: number }): [number, number] {
  const path = join(dir, file)
  if (file.endsWith('.svg')) {
    const svg = readFileSync(path, 'utf8')
    const width = Number(/<svg[^>]*\swidth="(\d+)"/.exec(svg)?.[1])
    const height = Number(/<svg[^>]*\sheight="(\d+)"/.exec(svg)?.[1])
    return [width / frame.w, height / frame.h]
  }
  const png = readFileSync(path)
  return [png.readUInt32BE(16) / frame.w, png.readUInt32BE(20) / frame.h]
}

describe('mascot sheets', () => {
  it('there is at least one mascot and active.json points at one of them', () => {
    const active = JSON.parse(readFileSync(join(mascotRoot, 'active.json'), 'utf8')) as {
      id: string
    }

    expect(ids.length).toBeGreaterThan(0)
    expect(ids).toContain(active.id)
  })

  for (const id of ids) {
    describe(id, () => {
      const dir = join(mascotRoot, id)
      const sheet = JSON.parse(readFileSync(join(dir, 'sheet.json'), 'utf8')) as MascotSheet

      it('follows the sheet.json contract', () => {
        expect(sheet.version).toBe(1)
        expect(sheet.id).toBe(id)
        expect(sheet.frame).toEqual({ w: 64, h: 64 })
        expect(['smooth', 'pixelated']).toContain(sheet.render)
        expect(['sheet.svg', 'sheet.png']).toContain(sheet.sheet)
        expect(existsSync(join(dir, sheet.sheet))).toBe(true)
        expect([sheet.columns, sheet.rows]).toEqual(sheetSize(dir, sheet.sheet, sheet.frame))
      })

      it('ships every required state with frames inside the sheet, fps 1–12 and a still frame', () => {
        const [cols, rows] = sheetSize(dir, sheet.sheet, sheet.frame)
        expect(Number.isInteger(cols) && Number.isInteger(rows)).toBe(true)

        for (const state of MASCOT_STATES) {
          const spec = sheet.states[state]
          expect(spec, state).toBeDefined()
          expect(spec.frames.length, `${state} frames`).toBeGreaterThanOrEqual(1)
          for (const [col, row] of spec.frames) {
            expect(col, `${state} col`).toBeGreaterThanOrEqual(0)
            expect(col, `${state} col`).toBeLessThan(cols)
            expect(row, `${state} row`).toBeGreaterThanOrEqual(0)
            expect(row, `${state} row`).toBeLessThan(rows)
          }
          expect(Number.isInteger(spec.fps), `${state} fps`).toBe(true)
          expect(spec.fps, `${state} fps`).toBeGreaterThanOrEqual(1)
          expect(spec.fps, `${state} fps`).toBeLessThanOrEqual(12)
          expect(typeof spec.loop).toBe('boolean')
          expect(spec.still, `${state} still`).toBeGreaterThanOrEqual(0)
          expect(spec.still, `${state} still`).toBeLessThan(spec.frames.length)
        }
      })

      it('lays the frames of a state side by side on one row, for the steps() animation', () => {
        for (const state of MASCOT_STATES) {
          const frames = sheet.states[state].frames
          const [firstCol, row] = frames[0]
          frames.forEach(([col, frameRow], index) => {
            expect([col, frameRow], `${state} frame ${index}`).toEqual([firstCol + index, row])
          })
        }
      })

      it('carries a licence that states the artwork is original', () => {
        const licence = readFileSync(join(dir, 'LICENSE.md'), 'utf8')

        expect(licence).toMatch(/original artwork/i)
        expect(licence).toContain('AGPL-3.0-only')
      })
    })
  }
})
