import { ownerAccount, partnerAccount } from '../accounts.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'

const owner = ownerAccount()
const partner = partnerAccount()

test.describe('J11 invitation', () => {
  test('the owner invites by link, the partner accepts and both see the trip', async ({
    browser,
    page,
  }) => {
    // The owner creates the trip and issues a link invitation.
    await signIn(page, owner)
    await page.getByTestId('trips.create').click()
    const sheet = page.getByRole('dialog')
    await sheet.getByTestId('trips.create.name').fill('Shared escape')
    await sheet.getByTestId('trips.create.startsOn').fill('2027-05-01')
    await sheet.getByTestId('trips.create.endsOn').fill('2027-05-14')
    await sheet.getByTestId('trips.create.baseCurrency').fill('EUR')
    await sheet.getByTestId('trips.create.submit').click()
    await expect(page).toHaveURL(/\/t\/[0-9a-f-]{36}\/today$/)
    const tripUrl = new URL(page.url())
    const tripPath = tripUrl.pathname.replace(/\/today$/, '')

    await page.getByTestId('shell.tab.more').click()
    await page.getByTestId('trip.more.members').click()
    await expect(page.getByTestId('trip.members.item')).toHaveCount(1)
    await expect(page.getByTestId('trip.members.item')).toContainText('Owner')
    await page.getByTestId('trip.members.inviteLink').click()
    const inviteUrl = (await page.getByTestId('trip.members.linkUrl').textContent())!.trim()
    expect(inviteUrl).toMatch(/\/invite\/[A-Za-z0-9_-]{20,}$/)
    // The link is shown once: the button that issued it is gone.
    await expect(page.getByTestId('trip.members.inviteLink')).toHaveCount(0)

    // The partner opens the link on their own device, signs in with the token kept, and joins.
    const partnerContext = await browser.newContext()
    const partnerPage = await partnerContext.newPage()
    try {
      await partnerPage.goto(new URL(inviteUrl).pathname)
      await expect(partnerPage.getByTestId('auth.invite.preview')).toHaveText(
        'Join Shared escape as editor.'
      )
      await partnerPage.getByTestId('auth.invite.login').click()
      await expect(partnerPage).toHaveURL(/\/login\?returnUrl=%2Finvite%2F/)
      await signIn(partnerPage, partner, /\/invite\//)
      await expect(partnerPage.getByTestId('auth.invite.preview')).toBeVisible()
      await partnerPage.getByTestId('auth.invite.accept').click()

      await expect(partnerPage).toHaveURL(new RegExp(`${tripPath}/today$`))
      await expect(partnerPage.getByTestId('shell.name')).toHaveText('Shared escape')
      await expect(partnerPage.getByTestId('ui.toast')).toContainText('You joined Shared escape')

      await partnerPage.goto(`${tripPath}/more/members`)
      await expect(partnerPage.getByTestId('trip.members.item')).toHaveCount(2)
      await expect(partnerPage.getByTestId('trip.members.item').nth(0)).toContainText('Owner')
      await expect(partnerPage.getByTestId('trip.members.item').nth(1)).toContainText('Partner')
      // An editor sees no invitation controls.
      await expect(partnerPage.getByTestId('trip.members.inviteSection')).toHaveCount(0)

      await partnerPage.goto(`${tripPath}/more/activity`)
      await expect(partnerPage.getByTestId('trip.activity.title')).toHaveText('Activity')
      expect(await partnerPage.locator('body').innerText()).not.toMatch(RAW_KEY)

      await partnerPage.goto('/trips')
      await expect(
        partnerPage.getByTestId('trips.item').filter({ hasText: 'Shared escape' })
      ).toHaveCount(1)
    } finally {
      await partnerContext.close()
    }

    // The owner sees the new member and the trip in the list.
    await page.reload()
    await expect(page.getByTestId('trip.members.item')).toHaveCount(2)
    await page.goto('/trips')
    await expect(page.getByTestId('trips.item').filter({ hasText: 'Shared escape' })).toHaveCount(1)
  })

  test('an unknown invitation link is not found', async ({ page, request }) => {
    // Any unknown token: the preview is public and answers "not found".
    await page.goto('/invite/not-a-real-token-0123456789abcdef')

    await expect(page.getByTestId('auth.invite.notFound')).toContainText('Invitation not found')
    const response = await request.get('/api/v1/invitations/not-a-real-token-0123456789abcdef')
    expect(response.status()).toBe(404)
  })
})
