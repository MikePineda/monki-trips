import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import type { ApiResponse } from '@japa/api-client'
import type { AiAction, AssistantStreamEvent } from '@monkitrips/shared'
import { actingAs } from '#tests/helpers/acting_as'
import { chatScript, say, startConversation } from '#tests/helpers/assistant'
import { committedWork } from '#tests/helpers/committed_work'
import { useFakeLlm } from '#tests/helpers/fake_llm'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { makeTrip } from '#tests/helpers/make_trip'
import { mutation } from '#tests/helpers/sync'

function proposals(events: AssistantStreamEvent[]): AiAction[] {
  return events.flatMap((event) => (event.type === 'proposal' ? [event.action] : []))
}

/**
 * Races between an accept and other writes, with real transactions: each
 * test runs outside the global transaction (`committedWork`), so two
 * requests hold their own connections and block on each other's locks.
 */
test.group('Trip assistant under concurrency', (group) => {
  useFixedClock(group, new Date('2026-11-07T10:00:00Z'))
  const llm = useFakeLlm(group)

  test('an accept racing a sync push on the same event never deadlocks', async ({
    client,
    assert,
  }) => {
    await committedWork(async (scope) => {
      const owner = await scope.user()
      const trip = await makeTrip(owner, { homeTz: 'Asia/Bangkok' })
      const conversation = await startConversation(client, owner, trip.id)
      for (let round = 0; round < 4; round += 1) {
        const [event] = await db
          .table('events')
          .insert({
            trip_id: trip.id,
            kind: 'tour',
            title: `Walk ${round}`,
            starts_local: '2027-01-22T09:00:00',
            start_tz: 'Asia/Bangkok',
            starts_at: '2027-01-22T02:00:00Z',
            starts_on: '2027-01-22',
          })
          .returning('id')
        llm.current.script(
          'chat',
          `race-${round}`,
          chatScript(
            {
              tool: 'propose_event_changes',
              input: {
                changes: [{ op: 'move', eventId: event.id, startsLocal: '2027-01-24T09:00' }],
              },
            },
            { text: 'Proposed.' }
          )
        )
        const { events } = await say(client, owner, trip.id, conversation.id, `Move ${round}`)
        const [action] = proposals(events)

        const [accepted, pushed]: ApiResponse[] = await Promise.all([
          actingAs(client.post(`/api/v1/trips/${trip.id}/ai/actions/${action.id}/accept`), owner),
          actingAs(client.post('/api/v1/sync/push'), owner).json({
            mutations: [
              mutation(trip.id, 'event', { title: `Walk ${round} renamed` }, { id: event.id }),
            ],
          }),
        ])

        assert.oneOf(accepted.status(), [200, 409], `round ${round}: ${accepted.text()}`)
        pushed.assertStatus(200)
        assert.equal(pushed.body().data.results[0].status, 'applied', `round ${round}`)
      }
    })
  })

  test('two accepts of the same proposal at once apply it exactly once', async ({
    client,
    assert,
  }) => {
    await committedWork(async (scope) => {
      const owner = await scope.user()
      const trip = await makeTrip(owner)
      llm.current.script(
        'chat',
        'double',
        chatScript({ tool: 'create_task', input: { title: 'Buy sunscreen' } }, { text: 'Ok.' })
      )
      const conversation = await startConversation(client, owner, trip.id)
      const { events } = await say(client, owner, trip.id, conversation.id, 'Sunscreen')
      const [action] = proposals(events)
      const accept = () =>
        actingAs(client.post(`/api/v1/trips/${trip.id}/ai/actions/${action.id}/accept`), owner)

      const responses: ApiResponse[] = await Promise.all([accept(), accept(), accept()])

      const statuses = responses.map((response) => response.status()).sort()
      assert.deepEqual(statuses, [200, 409, 409])
      for (const response of responses.filter((one) => one.status() === 409)) {
        response.assertBodyContains({ code: 'E_AI_ACTION_CLOSED', status: 'accepted' })
      }
      const tasks = await db.from('tasks').where('trip_id', trip.id).where('origin', 'ai')
      assert.lengthOf(tasks, 1)
      const activity = await db.from('trip_activity').where('entity_id', tasks[0].id)
      assert.lengthOf(activity, 1)
    })
  })
})
