import { test, expect } from '@playwright/test';
import { registerPatient, fillAndSubmitLogin, totpCode } from './helpers.js';

test('a patient can enable 2FA, then log back in with a real TOTP code', async ({ page, request }) => {
  const patient = await registerPatient(request, { emailPrefix: 'e2e-2fa' });

  await page.goto('/login');
  await fillAndSubmitLogin(page, patient.email, patient.password);
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/security');
  await page.getByRole('button', { name: 'Enable two-factor authentication' }).click();

  const secret = await page.locator('.secret-key').textContent();
  expect(secret).toBeTruthy();

  await page.getByLabel('6-digit code').fill(totpCode(secret));
  await page.getByRole('button', { name: 'Confirm & enable' }).click();

  await expect(page.getByRole('heading', { name: 'Save your recovery codes' })).toBeVisible();
  const recoveryCodeCount = await page.locator('.recovery-code').count();
  expect(recoveryCodeCount).toBe(8);
  await page.getByRole('button', { name: "I've saved these codes" }).click();

  await expect(page.getByRole('heading', { name: 'Two-factor authentication is on' })).toBeVisible();

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login/);

  // Password alone must not be enough to get in once 2FA is on.
  await fillAndSubmitLogin(page, patient.email, patient.password);
  await expect(page.getByRole('heading', { name: 'Two-factor verification' })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('Authentication code').fill(totpCode(secret));
  await page.getByRole('button', { name: 'Verify' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
});
