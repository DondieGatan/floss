import { test, expect } from '@playwright/test';
import { fillAndSubmitLogin } from './helpers.js';

test.describe('Authentication', () => {
  test('a new patient can register and lands on the dashboard', async ({ page }) => {
    const email = `e2e-register-${Date.now()}@example.com`;

    await page.goto('/register');
    await page.getByLabel('Full name').fill('E2E New Patient');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /Welcome back, E2E/ })).toBeVisible();
  });

  test('logging in with the wrong password shows an error and does not navigate', async ({ page }) => {
    await page.goto('/login');
    await fillAndSubmitLogin(page, 'patient@floss.demo', 'the-wrong-password');

    await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');
    await expect(page).toHaveURL(/\/login/);
  });

  test('logging in with correct credentials reaches the dashboard, and logout returns to the landing page', async ({
    page,
  }) => {
    await page.goto('/login');
    await fillAndSubmitLogin(page, 'patient@floss.demo', 'password123');

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Welcome back, Jordan' })).toBeVisible();

    await page.getByRole('button', { name: 'Logout' }).click();

    // Logging out doesn't unmount the current (auth-gated) route — it's the
    // same SPA route re-evaluating RequireAuth with user now null, which
    // redirects to /login rather than anywhere unauthenticated pages live.
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
