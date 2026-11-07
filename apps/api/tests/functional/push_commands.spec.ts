import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import ace from '@adonisjs/core/services/ace'
import PushSubscription from '#models/push_subscription'
import { useFakePushSender } from '#tests/helpers/fake_push'
import { makeUser } from '#tests/helpers/make_user'

const VAPID_PUBLIC = /^VAPID_PUBLIC_KEY=B[A-Za-z0-9_-]{86}$/
const VAPID_PRIVATE = /^VAPID_PRIVATE_KEY=[A-Za-z0-9_-]{43}$/

test.group('Push commands', (group) => {
  const push = useFakePushSender(group)

  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('vapid generate prints a key pair without storing it', async ({ assert }) => {
    const command = await ace.exec('vapid:generate', [])

    command.assertSucceeded()
    const lines = command.logger.getLogs().map((log) => log.message)
    const publicLine = lines.find((line) => VAPID_PUBLIC.test(line))
    const privateLine = lines.find((line) => VAPID_PRIVATE.test(line))
    assert.isDefined(publicLine)
    assert.isDefined(privateLine)
    assert.include(lines, 'VAPID_SUBJECT=mailto:admin@example.com')
    // Nothing on disk learned the pair: the committed examples keep their placeholders.
    const privateKey = privateLine!.slice('VAPID_PRIVATE_KEY='.length)
    for (const file of ['.env.example', '.env.test']) {
      assert.notInclude(await readFile(app.makePath(file), 'utf8'), privateKey)
    }
  })

  test('two runs of vapid generate never repeat a pair', async ({ assert }) => {
    await ace.exec('vapid:generate', [])
    const second = await ace.exec('vapid:generate', [])

    // The kernel's logger keeps every line of the group: all printed keys must differ.
    const publicKeys = second.logger
      .getLogs()
      .map((log) => log.message)
      .filter((line) => VAPID_PUBLIC.test(line))
    assert.isAtLeast(publicKeys.length, 2)
    assert.equal(new Set(publicKeys).size, publicKeys.length)
  })

  test('push test sends to every device of the account named by e-mail', async ({ assert }) => {
    const user = await makeUser({ email: 'traveller@example.com' })
    await PushSubscription.create({
      userId: user.id,
      endpoint: 'https://push.example.com/send/cli',
      p256dh: 'key',
      auth: 'secret',
    })

    const command = await ace.exec('push:test', ['--user', 'Traveller@Example.com'])

    command.assertSucceeded()
    assert.lengthOf(push.sentTo('https://push.example.com/send/cli'), 1)
    command.assertLogMatches(/sent 1, pruned 0 \(gone\), failed 0/)
  })

  test('push test fails for an unknown account', async () => {
    const command = await ace.exec('push:test', ['--user', 'nobody@example.com'])

    command.assertFailed()
    command.assertLogMatches(/no account matches/)
  })
})
