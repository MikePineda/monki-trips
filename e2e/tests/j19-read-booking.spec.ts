import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { syntheticBookingPdf } from '../booking-pdf.ts'
import { expect, test } from '../fixtures.ts'
import { signIn } from '../sign-in.ts'

/**
 * J19: read a booking. A synthetic ferry confirmation is uploaded; on its
 * detail the member taps "Read this booking" (the API runs
 * `LLM_PROVIDER=fake`, answering e2e/fixtures/llm/extract_booking: the
 * departure zone is unknown and flagged). The review sheet flags the
 * field, the member fixes the departure time and zone, accepts, and the
 * ferry shows on its day in Plan with the document linked. Nothing is
 * written before Accept.
 */
test.use({ serviceWorkers: 'block' })

test.describe('J19 read a booking', () => {
  let solo: E2eAccount
  let tripId: string
  let documentId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j19')
    const api = await ApiSession.signIn(solo)
    try {
      await api.deleteAllTrips()
      tripId = await api.createTrip({
        name: 'Island hop',
        startsOn: '2027-03-01',
        endsOn: '2027-03-05',
        baseCurrency: 'EUR',
      })
      documentId = await api.uploadDocument(
        tripId,
        { name: 'ferry.pdf', mimeType: 'application/pdf', buffer: syntheticBookingPdf() },
        { title: 'Ferry booking' }
      )
    } finally {
      await api.dispose()
    }
  })

  test('read a pdf booking, fix a time, accept and see the event in plan', async ({ page }) => {
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/docs/${documentId}`)
    const detail = page.getByRole('dialog')
    await expect(detail.getByTestId('docs.detail.readPrivacy')).toBeVisible()

    await detail.getByTestId('docs.detail.readBooking').click()
    const review = page.getByTestId('docs.review')
    await expect(review).toBeVisible({ timeout: 15_000 })
    await expect(review.getByTestId('docs.review.flag.segments.0.departsTz')).toBeVisible()
    await expect(review.getByTestId('docs.review.flag.segments.0.departsLocal')).toHaveAttribute(
      'data-reason',
      'low_confidence'
    )

    // Nothing is in the plan before Accept.
    const api = await ApiSession.signIn(solo)
    try {
      expect((await api.snapshot(tripId)).events).toHaveLength(0)
    } finally {
      await api.dispose()
    }

    await review.getByTestId('docs.review.field.segments.0.departsLocal').fill('2027-03-02T10:15')
    await review.getByTestId('docs.review.field.segments.0.departsTz').fill('Europe/Lisbon')
    // Accept sits in the sheet's footer, outside the fields.
    await page.getByTestId('docs.review.accept').click()
    await expect(page.getByTestId('docs.review')).toHaveCount(0, { timeout: 15_000 })

    await page.goto(`/t/${tripId}/plan`)
    const day = page.locator('[data-testid="plan.day"][data-date="2027-03-02"]')
    await expect(day.getByTestId('plan.event')).toContainText('Ferry to Aldermoor', {
      timeout: 15_000,
    })
    await expect(day.getByTestId('plan.event')).toContainText('10:15')

    const after = await ApiSession.signIn(solo)
    try {
      const snapshot = await after.snapshot(tripId)
      expect(snapshot.events).toHaveLength(1)
      const document = snapshot.documents.find((one) => one.id === documentId)
      expect(document?.eventId).toBe(snapshot.events[0].id)
    } finally {
      await after.dispose()
    }
  })
})
