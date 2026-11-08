import { randomUUID } from 'node:crypto'
import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { expect, test } from '../fixtures.ts'
import { signIn } from '../sign-in.ts'

/**
 * J16: phrase cards. Before the trip a member generates Thai cards (the
 * API runs `LLM_PROVIDER=fake`, answering e2e/fixtures/llm/phrase_cards);
 * then, with no connection, the cards come from the device and one opens
 * full screen with the name filled in on the phone, also from Today's
 * "Show to driver". The service worker is blocked: the journey proves the
 * device's copy, not the cache.
 */
test.use({ serviceWorkers: 'block' })

test.describe('J16 phrase cards', () => {
  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j16')
    const api = await ApiSession.signIn(solo)
    try {
      await api.deleteAllTrips()
      tripId = await api.createTrip({
        name: 'Temple escape',
        startsOn: '2030-04-01',
        endsOn: '2030-04-05',
        baseCurrency: 'THB',
      })
      await api.push(tripId, [
        {
          entity: 'stop',
          id: randomUUID(),
          changes: {
            position: 0,
            name: 'Demo Town',
            countryCode: 'TH',
            tz: 'Asia/Bangkok',
            arriveOn: '2030-04-01',
            departOn: '2030-04-05',
          },
        },
        {
          entity: 'event',
          id: randomUUID(),
          changes: {
            kind: 'lodging',
            title: 'Demo Riverside Inn',
            status: 'booked',
            startsLocal: '2030-04-01T15:00',
            startTz: 'Asia/Bangkok',
            endsLocal: '2030-04-05T11:00',
            endTz: 'Asia/Bangkok',
            address: '9 Example Road, Demo Town',
            addressLocal: '9 ถนนตัวอย่าง',
          },
        },
      ])
    } finally {
      await api.dispose()
    }
  })

  test('generates Thai cards online, then shows one full screen offline', async ({
    page,
    context,
  }) => {
    await signIn(page, solo)
    // Today first, online: tonight's stay shows, with no card to show the driver yet.
    // (It also loads Today's script: this journey blocks the service worker.)
    await page.goto(`/t/${tripId}/today`)
    await expect(page.getByTestId('today.tonight.name')).toHaveText('Demo Riverside Inn')
    await expect(page.getByTestId('today.tonight.showDriver')).toHaveCount(0)

    await page.getByTestId('shell.tab.more').click()
    await page.getByTestId('trip.more.phrases').click()
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/more/phrases$`))

    // Thailand's language is preselected from the stop.
    await expect(page.getByTestId('phrases.language')).toHaveValue('th')
    await expect(page.getByTestId('phrases.empty')).toBeVisible()

    await page
      .getByTestId('phrases.food.option')
      .filter({ hasText: 'No peanuts' })
      .getByRole('button')
      .click()
    await page.getByTestId('phrases.generate').click()
    await expect(page.getByTestId('phrases.card').first()).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByTestId('phrases.card')).toHaveCount(8)
    await expect(page.getByTestId('phrases').getByText('ขอบคุณครับ')).toBeVisible()
    // The name is filled on the device; the stored card keeps the placeholder.
    await expect(page.getByTestId('phrases')).toContainText(`ผมจองไว้ในชื่อ ${solo.displayName}`)
    await expect(page.getByTestId('phrases')).not.toContainText('{name}')

    // No connection: leave and come back inside the app, the device's copy answers.
    await context.setOffline(true)
    await page.getByTestId('shell.tab.more').click()
    await page.getByTestId('trip.more.phrases').click()
    await expect(page.getByTestId('phrases.offline')).toBeVisible()
    await expect(page.getByTestId('phrases.generate')).toBeDisabled()
    await expect(page.getByTestId('phrases.card')).toHaveCount(8)

    await page.getByTestId('phrases.card').filter({ hasText: 'reservation' }).click()
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/more/phrases/show/`))
    const shown = page.getByTestId('phrases.show')
    await expect(shown).toBeVisible()
    await expect(shown.getByTestId('ui.showCard.phrase')).toHaveText(
      `ผมจองไว้ในชื่อ ${solo.displayName}`
    )
    await expect(shown.getByTestId('ui.showCard.phrase')).toHaveAttribute('lang', 'th')
    await shown.getByTestId('ui.showCard.close').click()
    await expect(shown).toBeHidden()

    // Today previews day 1: tonight's stay has its address card one tap away.
    await page.getByTestId('shell.tab.today').click()
    await page.getByTestId('today.tonight.showDriver').click()
    await expect(page.getByTestId('ui.showCard.phrase')).toHaveText('กรุณาไปส่งที่ 9 ถนนตัวอย่าง')
  })
})
