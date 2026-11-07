import { expect, type Page } from '@playwright/test'
import type { E2eAccount } from './accounts.ts'

/** Raw Transloco keys would look like `shell.trips.title` or `auth.login.submit`. */
export const RAW_KEY =
  /\b(?:shell|settings|offline|ui|app|update|sync|auth|account)\.[a-zA-Z]+\.[a-zA-Z.]+/

/**
 * Signs the account in through the real form and waits for the destination:
 * `/trips`, or the `returnUrl` the login page was opened with.
 */
export async function signIn(page: Page, account: E2eAccount, destination = /\/trips$/) {
  if (!/\/login(\?|$)/.test(page.url())) {
    await page.goto('/login')
  }
  await page.getByTestId('auth.login.email').fill(account.email)
  await page.getByTestId('auth.login.password').fill(account.password)
  await page.getByTestId('auth.login.submit').click()
  await expect(page).toHaveURL(destination)
}

/** Signs out from Settings and waits for the sign-in page. */
export async function signOut(page: Page) {
  await page.goto('/settings')
  await page.getByTestId('account.signOut').click()
  await expect(page).toHaveURL(/\/login$/)
}
