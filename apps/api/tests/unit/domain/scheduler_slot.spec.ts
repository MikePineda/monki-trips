import { test } from '@japa/runner'
import { shouldStartScheduler, slotKey } from '#domain/scheduler_slot'

test.group('Scheduler slots', () => {
  test('a slot key is the utc instant truncated to the interval', ({ assert }) => {
    const now = new Date('2026-11-07T10:42:17.345Z')

    assert.equal(slotKey('minute', now), '2026-11-07T10:42Z')
    assert.equal(slotKey('hour', now), '2026-11-07T10:00Z')
    assert.equal(slotKey('day', now), '2026-11-07')
  })

  test('two instants in the same slot share the key, the next slot does not', ({ assert }) => {
    assert.equal(
      slotKey('hour', new Date('2026-11-07T10:00:00Z')),
      slotKey('hour', new Date('2026-11-07T10:59:59Z'))
    )
    assert.notEqual(
      slotKey('hour', new Date('2026-11-07T10:59:59Z')),
      slotKey('hour', new Date('2026-11-07T11:00:00Z'))
    )
  })

  test('the scheduler starts in the web server only, and not with SCHEDULER=off', ({ assert }) => {
    assert.isTrue(shouldStartScheduler({ scheduler: undefined, environment: 'web' }))
    assert.isTrue(shouldStartScheduler({ scheduler: 'on', environment: 'web' }))
    assert.isFalse(shouldStartScheduler({ scheduler: 'off', environment: 'web' }))
    assert.isFalse(shouldStartScheduler({ scheduler: 'on', environment: 'console' }))
    assert.isFalse(shouldStartScheduler({ scheduler: 'on', environment: 'test' }))
  })
})
