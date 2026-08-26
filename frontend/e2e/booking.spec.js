import { test, expect } from '@playwright/test';
import { registerPatient, loginAsAdmin, createBookableDoctor, fillAndSubmitLogin } from './helpers.js';

test('a patient can book an appointment end-to-end and see it on My Appointments', async ({ page, request }) => {
  const patient = await registerPatient(request, { emailPrefix: 'e2e-booking' });
  const adminToken = await loginAsAdmin(request);
  const doctor = await createBookableDoctor(request, adminToken);

  await page.goto('/login');
  await fillAndSubmitLogin(page, patient.email, patient.password);
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/doctors');
  const doctorCard = page.locator('.doctor-card').filter({ hasText: doctor.fullName });
  await doctorCard.getByRole('link', { name: 'Book appointment' }).click();

  const firstSlot = page.locator('.slot-btn').first();
  await expect(firstSlot).toBeVisible();
  await firstSlot.click();
  await expect(firstSlot).toHaveAttribute('aria-pressed', 'true');

  await page.getByPlaceholder('e.g. Annual check-up').fill('E2E booking test');
  await page.getByRole('button', { name: /Confirm/ }).click();

  await expect(page.getByText('Appointment booked')).toBeVisible();

  await page.goto('/appointments');
  await expect(page.getByText(doctor.fullName)).toBeVisible();
  await expect(page.getByText('E2E booking test')).toBeVisible();
});
