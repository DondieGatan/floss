import { test, expect } from '@playwright/test';
import { fillAndSubmitLogin } from './helpers.js';

// Read-only navigation only — no mutations here, since admin@floss.demo is
// a shared seeded account other specs/manual testing may also rely on.
test('staff/admin sees management navigation and can reach role-gated pages', async ({ page }) => {
  await page.goto('/login');
  await fillAndSubmitLogin(page, 'admin@floss.demo', 'password123');

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();

  // A patient never sees these — confirms the RBAC-driven sidebar actually
  // reflects the admin role, not just that /dashboard didn't 404. Scoped
  // to the sidebar nav specifically: the dashboard's own quick-action
  // buttons ("Manage directory") would otherwise also substring-match.
  const sidebarNav = page.getByRole('navigation', { name: 'Primary' });
  await expect(sidebarNav.getByRole('link', { name: 'Directory', exact: true })).toBeVisible();
  await expect(sidebarNav.getByRole('link', { name: 'Team & Roles' })).toBeVisible();

  await sidebarNav.getByRole('link', { name: 'Team & Roles' }).click();
  await expect(page).toHaveURL(/\/manage\/users/);
  await expect(page.getByRole('heading', { name: 'Team & Roles' })).toBeVisible();
  await expect(page.getByText('admin@floss.demo')).toBeVisible();

  await sidebarNav.getByRole('link', { name: 'Directory', exact: true }).click();
  await expect(page).toHaveURL(/\/manage\/directory/);
});

test('a patient account never sees staff-only navigation or routes', async ({ page }) => {
  await page.goto('/login');
  await fillAndSubmitLogin(page, 'patient@floss.demo', 'password123');
  await expect(page).toHaveURL(/\/dashboard/);

  await expect(page.getByRole('link', { name: 'Team & Roles' })).toHaveCount(0);

  await page.goto('/manage/users');
  await expect(page).toHaveURL(/\/dashboard/);
});
