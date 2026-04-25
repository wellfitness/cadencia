import { test, expect } from '@playwright/test';

test('app shell loads with hero copy', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /spoty cycling/i })).toBeVisible();
});
