import { test } from '@japa/runner'
import { readdir } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'

test.group('Migration order', () => {
  test('migration files are numbered 0000, 0001, ... without gaps', async ({ assert }) => {
    const entries = await readdir(app.makePath('database/migrations'))
    const files = entries.filter((file) => file.endsWith('.ts')).sort()

    // Lucid applies files in name order: a gap invites a later file that sorts
    // before ones already applied, and fresh and upgraded databases diverge.
    assert.isNotEmpty(files)
    files.forEach((file, index) => {
      assert.match(file, new RegExp(`^${String(index).padStart(4, '0')}_[a-z0-9_]+\\.ts$`))
    })
  })
})
