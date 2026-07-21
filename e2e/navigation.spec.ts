import { expect, test } from '@playwright/test';

test('navigating via the main nav scrolls the new page to the top', async ({ page }) => {
  await page.goto('/runs');

  await expect
    .poll(() =>
      page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        return window.scrollY;
      }),
    )
    .toBeGreaterThan(0);

  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: 'Live' })
    .click();

  await expect(page).toHaveURL(/\/live$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('browser back restores the previous scroll position', async ({ page }) => {
  await page.goto('/runs');

  await expect
    .poll(() =>
      page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        return window.scrollY;
      }),
    )
    .toBeGreaterThan(0);
  const scrolled = await page.evaluate(() => window.scrollY);

  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: 'Live' })
    .click();
  await expect(page).toHaveURL(/\/live$/);

  await page.goBack();

  await expect(page).toHaveURL(/\/runs$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled - 50);
});
