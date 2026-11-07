import { test } from '@japa/runner'
import type { Logger } from '@adonisjs/core/logger'
import { LogMailer } from '#services/log_mailer'

test.group('Log mailer', () => {
  test('never logs the recipient address, only a masked form', async ({ assert }) => {
    const lines: unknown[][] = []
    const logger = { info: (...args: unknown[]) => lines.push(args) } as unknown as Logger
    const mailer = new LogMailer(logger)

    await mailer.send({
      to: 'member@example.com',
      subject: 'Reset your password',
      text: 'secret link',
    })

    assert.lengthOf(lines, 1)
    const logged = JSON.stringify(lines[0])
    assert.notInclude(logged, 'member@example.com')
    assert.notInclude(logged, 'secret link')
    assert.deepInclude(lines[0][0] as object, {
      to: 'm***@example.com',
      subject: 'Reset your password',
    })
  })
})
