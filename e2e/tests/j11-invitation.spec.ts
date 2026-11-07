import { ownerAccount, partnerAccount } from '../accounts.ts'
import { expect, test } from '../fixtures.ts'
import { RAW_KEY, signIn } from '../sign-in.ts'

const owner = ownerAccount()
const partner = partnerAccount()

/** A plaintext invitation token, as it appears in a link. */
const TOKEN_IN_TEXT = /invite\/[A-Za-z0-9_-]{20,}/

test.describe('J11 invitation', () => {
  test('the owner invites by link, the partner accepts, ownership moves and the feed is honest', async ({
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
    // The link is shown once: the button that issued it is gone, and the pending list has no token.
    await expect(page.getByTestId('trip.members.inviteLink')).toHaveCount(0)
    await expect(page.getByTestId('trip.members.invitation')).toHaveCount(1)
    await expect(page.getByTestId('trip.members.invitation')).toContainText('Invitation link')
    expect(await page.getByTestId('trip.members.invitation').innerText()).not.toMatch(TOKEN_IN_TEXT)

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
      await expect(partnerPage.getByTestId('trip.members.item').nth(1)).toContainText(
        'Partner (you)'
      )
      // An editor sees the way out, never the owner's controls.
      await expect(partnerPage.getByTestId('trip.members.inviteSection')).toHaveCount(0)
      await expect(partnerPage.getByTestId('trip.members.makeOwner')).toHaveCount(0)
      await expect(partnerPage.getByTestId('trip.members.leave')).toBeVisible()
      // Both people travel: the accepted invitation created the partner's traveller.
      await expect(partnerPage.getByTestId('trip.members.traveller')).toHaveCount(2)
      expect(await partnerPage.locator('body').innerText()).not.toMatch(RAW_KEY)

      await partnerPage.goto('/trips')
      await expect(
        partnerPage.getByTestId('trips.item').filter({ hasText: 'Shared escape' })
      ).toHaveCount(1)
    } finally {
      await partnerContext.close()
    }

    // The owner sees the new member; the accepted invitation left the pending list.
    await page.reload()
    await expect(page.getByTestId('trip.members.item')).toHaveCount(2)
    await expect(page.getByTestId('trip.members.noInvitations')).toBeVisible()

    // An invitation by e-mail: the API mails the token, the screen only says it was sent.
    await page.getByTestId('trip.members.inviteEmail').fill('friend@example.com')
    await page.getByTestId('trip.members.sendEmail').click()
    await expect(page.getByTestId('trip.members.emailSent')).toContainText(
      'Invitation sent to friend@example.com'
    )
    await expect(page.getByTestId('trip.members.invitation')).toHaveCount(1)
    await expect(page.getByTestId('trip.members.invitation')).toContainText('friend@example.com')
    expect(await page.locator('body').innerText()).not.toMatch(TOKEN_IN_TEXT)
    // ...and the owner can take it back.
    await page.getByTestId('trip.members.revoke').click()
    await page.getByRole('dialog').getByTestId('ui.confirm.confirm').click()
    await expect(
      page.getByTestId('ui.toast').filter({ hasText: 'Invitation revoked' })
    ).toBeVisible()
    await expect(page.getByTestId('trip.members.invitation')).toHaveCount(0)

    // A traveller without an account joins the list through the outbox.
    await expect(page.getByTestId('trip.members.traveller')).toHaveCount(2)
    await page.getByTestId('trip.members.addTraveller').click()
    await page.getByRole('dialog').getByTestId('trip.members.travellerName').fill('Little one')
    await page.getByRole('dialog').getByTestId('trip.members.travellerSave').click()
    await expect(page.getByTestId('trip.members.traveller')).toHaveCount(3)
    await expect(page.getByTestId('trip.members.traveller').nth(2)).toContainText('Little one')
    await expect(page.getByTestId('trip.members.traveller').nth(2)).toContainText('No account')

    // Ownership moves to the partner after an explicit confirmation naming them.
    await page.getByTestId('trip.members.makeOwner').click()
    const confirm = page.getByRole('dialog')
    await expect(confirm.getByTestId('ui.confirm.confirm')).toHaveText('Make Partner the owner')
    await confirm.getByTestId('ui.confirm.confirm').click()
    await expect(
      page.getByTestId('ui.toast').filter({ hasText: 'Partner is now the owner' })
    ).toBeVisible()
    await expect(page.getByTestId('trip.members.item').nth(0)).toContainText('Partner')
    await expect(page.getByTestId('trip.members.role').nth(0)).toHaveAttribute('data-role', 'owner')
    await expect(page.getByTestId('trip.members.item').nth(1)).toContainText('Owner (you)')
    await expect(page.getByTestId('trip.members.role').nth(1)).toHaveAttribute(
      'data-role',
      'editor'
    )
    await expect(page.getByTestId('trip.members.inviteSection')).toHaveCount(0)
    await expect(page.getByTestId('trip.members.leave')).toBeVisible()

    // The partner, now the owner, gets the owner's controls on their own device.
    const ownerContext = await browser.newContext()
    const newOwnerPage = await ownerContext.newPage()
    try {
      await signIn(newOwnerPage, partner)
      await newOwnerPage.goto(`${tripPath}/more/members`)
      await expect(newOwnerPage.getByTestId('trip.members.item').nth(0)).toContainText(
        'Partner (you)'
      )
      await expect(newOwnerPage.getByTestId('trip.members.role').nth(0)).toHaveAttribute(
        'data-role',
        'owner'
      )
      await expect(newOwnerPage.getByTestId('trip.members.inviteSection')).toBeVisible()
      await expect(newOwnerPage.getByTestId('trip.members.leave')).toHaveCount(0)

      // The activity feed: this API has no `GET /trips/:tripId/activity` yet (docs/BACKLOG.md),
      // so the page says so instead of pretending; the two changes above will show once it does.
      await newOwnerPage.goto(`${tripPath}/more/activity`)
      await expect(newOwnerPage.getByTestId('trip.activity.title')).toHaveText('Activity')
      await expect(newOwnerPage.getByTestId('trip.activity.error')).toHaveText(
        'This server does not serve the activity feed yet.'
      )
      await expect(newOwnerPage.getByTestId('trip.activity.empty')).toBeVisible()
      expect(await newOwnerPage.locator('body').innerText()).not.toMatch(RAW_KEY)
    } finally {
      await ownerContext.close()
    }

    // The former owner, an editor now, leaves: the trip is gone from their list.
    await page.getByTestId('trip.members.leave').click()
    await page.getByRole('dialog').getByTestId('ui.confirm.confirm').click()
    await expect(page).toHaveURL(/\/trips$/)
    await expect(
      page.getByTestId('ui.toast').filter({ hasText: 'You left the trip' })
    ).toBeVisible()
    await expect(page.getByTestId('trips.item').filter({ hasText: 'Shared escape' })).toHaveCount(0)
  })

  test('an unknown invitation link is not found', async ({ page, request }) => {
    // Any unknown token: the preview is public and answers "not found".
    await page.goto('/invite/not-a-real-token-0123456789abcdef')

    await expect(page.getByTestId('auth.invite.notFound')).toContainText('Invitation not found')
    const response = await request.get('/api/v1/invitations/not-a-real-token-0123456789abcdef')
    expect(response.status()).toBe(404)
  })
})
