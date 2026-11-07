import { fileURLToPath } from 'node:url'
import { soloAccount, type E2eAccount } from '../accounts.ts'
import { ApiSession } from '../api-session.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'

const VOUCHER = fileURLToPath(new URL('../fixtures/voucher.pdf', import.meta.url))

/**
 * J04: a synthetic PDF voucher is uploaded to the Docs tab, tagged
 * `print` (the print band shows and the server makes its "Print" task),
 * saved offline with a verified hash, and opened in the quick view with
 * no connection: the bytes come from the device's copy. The service
 * worker is blocked, so the quick view is opened once online first to
 * load the pdf.js chunks (J07 covers a cold offline boot with the real
 * service worker, which prefetches them).
 */
test.use({ serviceWorkers: 'block' })

test.describe('J04 documents', () => {
  test.describe.configure({ mode: 'default' })

  let solo: E2eAccount
  let tripId: string

  test.beforeEach(async ({}, testInfo) => {
    solo = soloAccount(testInfo.project.name, 'j04')
    const api = await ApiSession.signIn(solo)
    try {
      await api.deleteAllTrips()
      tripId = await api.createTrip({
        name: 'Voucher escape',
        startsOn: '2027-03-01',
        endsOn: '2027-03-05',
        baseCurrency: 'EUR',
      })
    } finally {
      await api.dispose()
    }
  })

  test('upload a pdf, tag it print, save it offline and open it with no connection', async ({
    page,
    context,
  }) => {
    await signIn(page, solo)
    await page.goto(`/t/${tripId}/docs`)
    await expect(page.getByTestId('docs.empty')).toContainText('Upload your passport first')

    // Upload the voucher.
    await page.getByTestId('docs.empty.add').click()
    const sheet = page.getByRole('dialog')
    await sheet.getByTestId('docs.upload.file').setInputFiles(VOUCHER)
    await expect(sheet.getByTestId('docs.upload.title')).toHaveValue('voucher')
    await sheet.getByTestId('docs.upload.title').fill('Ferry voucher')
    await sheet.getByTestId('docs.upload.submit').click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const row = page.getByTestId('docs.row')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Ferry voucher')
    await expect(row.getByTestId('docs.row.offline')).toContainText('Not saved')

    // Tag it print: the band shows in the list.
    await row.click()
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/docs/[0-9a-f-]{36}$`))
    const detail = page.getByRole('dialog')
    await detail.getByTestId('docs.detail.tag.print').locator('button').click()
    await expect(detail.getByTestId('docs.detail.tag.print').locator('button')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    // Save it offline: the copy's sha256 matches the server's.
    await detail.getByTestId('docs.detail.saveOffline').click()
    await expect(detail.getByTestId('docs.detail.offline')).toContainText('Saved offline', {
      timeout: 15_000,
    })
    await expect(detail.getByTestId('docs.detail.mismatch')).toHaveCount(0)

    // Online once: the quick view loads the pdf.js chunks and draws the page.
    await detail.getByTestId('docs.detail.view').click()
    await expect(detail.getByTestId('ui.preview.page').first()).toBeVisible({ timeout: 15_000 })
    await detail.getByTestId('ui.sheet.close').click()
    await expect(page).toHaveURL(new RegExp(`/t/${tripId}/docs$`))
    await expect(page.getByTestId('docs.print')).toContainText('Bring this printed')
    await expect(page.getByTestId('docs.print')).toContainText('Ferry voucher')
    await expect(row.getByTestId('docs.row.offline')).toContainText('Saved offline')

    // Everything reached the server: the document with its tag and the print task.
    await expect(page.getByTestId('shell.connection')).toHaveCount(0, { timeout: 15_000 })
    const api = await ApiSession.signIn(solo)
    try {
      const snapshot = await api.snapshot(tripId)
      expect(snapshot.documents.map((document) => [document.title, document.tags])).toEqual([
        ['Ferry voucher', ['print']],
      ])
      expect(snapshot.documents[0].sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(
        snapshot.tasks.filter(
          (task) => task.origin === 'document' && task.sourceDocumentId === snapshot.documents[0].id
        )
      ).toHaveLength(1)
    } finally {
      await api.dispose()
    }

    // Offline: the quick view still shows, from the device's copy.
    const fileRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/documents/')) fileRequests.push(request.url())
    })
    await context.setOffline(true)
    await expect(page.getByTestId('shell.connection')).toHaveAttribute('data-state', 'offline')
    await row.click()
    const offlineDetail = page.getByRole('dialog')
    await offlineDetail.getByTestId('docs.detail.view').click()
    await expect(offlineDetail.getByTestId('ui.preview.page').first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(offlineDetail.getByTestId('docs.detail.needsConnection')).toHaveCount(0)
    expect(fileRequests).toEqual([])
    await offlineDetail.getByTestId('ui.sheet.close').click()
    await expect(page.getByTestId('docs.print')).toBeVisible()

    expect(await page.locator('body').innerText()).not.toMatch(RAW_KEY)
  })
})
