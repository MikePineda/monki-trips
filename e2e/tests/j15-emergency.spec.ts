import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'

/**
 * J15: emergency information is saved from the form, reaches the server
 * through the outbox and stays readable, numbers tappable, with no
 * connection. The service worker is blocked: the journey proves the
 * device's copy, not the cache.
 */
test.use({ serviceWorkers: 'block' })

test.describe('J15 emergency info', () => {
  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name)
    const api = await ApiSession.signIn(solo)
    try {
      await api.deleteAllTrips()
      tripId = await api.createTrip({
        name: 'Emergency escape',
        startsOn: '2027-03-01',
        endsOn: '2027-03-10',
        baseCurrency: 'EUR',
      })
    } finally {
      await api.dispose()
    }
  })

  test('emergency info is saved, synced and shown offline with tappable numbers', async ({
    page,
    context,
  }) => {
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/more`)
    await page.getByTestId('trip.more.emergency').click()
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/more/emergency$`))
    await expect(page.getByTestId('emergency.empty')).toBeVisible()

    await page.getByTestId('emergency.add').click()
    await page.getByTestId('emergency.form.insurer').fill('Demo Assure')
    await page.getByTestId('emergency.form.policyNumber').fill('DEMO-0001')
    await page.getByTestId('emergency.form.assistancePhone').fill('+1 555 0100')
    await page.getByTestId('emergency.form.embassyName').fill('Consulate of Demo')
    await page.getByTestId('emergency.form.embassyPhone').fill('+1 555 0101')
    await page.getByTestId('emergency.form.hospitalName').fill('Demo General Hospital')
    await page.getByTestId('emergency.form.hospitalPhone').fill('+1 555 0102')
    await page.getByTestId('emergency.form.localEmergencyPhone').fill('112')
    await page.getByTestId('emergency.form.medical').fill('Allergic to synthetic data')
    await page.getByTestId('emergency.form.save').click()

    await expect(page.getByTestId('ui.toast')).toContainText('Emergency info saved')
    const read = page.getByTestId('emergency.read')
    await expect(read).toBeVisible()
    await expect(page.getByTestId('emergency.insurance.phone.link')).toHaveAttribute(
      'href',
      'tel:+15550100'
    )
    await expect(read).toContainText('Policy DEMO-0001')
    await expect(page.getByTestId('emergency.contact.link')).toHaveCount(2)
    await expect(page.getByTestId('emergency.contact.link').last()).toHaveAttribute(
      'href',
      'tel:112'
    )
    await expect(read).toContainText('Local emergency number')
    await expect(read).toHaveAttribute('data-sync', 'synced', { timeout: 15_000 })

    const api = await ApiSession.signIn(solo)
    try {
      const snapshot = await api.snapshot(tripId)
      expect(snapshot.emergency?.content).toMatchObject({
        insurance: { provider: 'Demo Assure', policyNumber: 'DEMO-0001', phone: '+1 555 0100' },
        embassy: { name: 'Consulate of Demo', phone: '+1 555 0101', address: null },
        medical: { notes: 'Allergic to synthetic data' },
      })
    } finally {
      await api.dispose()
    }

    // No connection: leave and come back inside the app, the device's copy answers.
    await context.setOffline(true)
    await page.getByTestId('shell.tab.more').click()
    await expect(page.getByTestId('trip.more.emergency')).toBeVisible()
    await page.getByTestId('trip.more.emergency').click()
    await expect(page.getByTestId('emergency.read')).toBeVisible()
    await expect(page.getByTestId('emergency.embassy.phone.link')).toHaveAttribute(
      'href',
      'tel:+15550101'
    )
    await expect(page.getByTestId('emergency.read')).toContainText('Demo General Hospital')
    await expect(page.getByTestId('emergency.read')).toContainText('Allergic to synthetic data')
    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
    await context.setOffline(false)
  })
})
