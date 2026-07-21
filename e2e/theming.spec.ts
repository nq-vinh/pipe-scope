import { expect, test, type Locator, type Page } from '@playwright/test';

test('defaults to the operating system color scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/runs');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(themeToggle(page)).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('pipescope-theme'))).toBeNull();
});

test('a binary override persists and is restored on reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/runs');

  await expect(themeToggle(page)).toHaveAttribute('aria-pressed', 'false');
  await themeToggle(page).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('pipescope-theme')))
    .toBe('dark');

  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(themeToggle(page)).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('pipescope-theme'))).toBe('dark');
});

test('toggling back to the operating system value clears the override', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/runs');

  await themeToggle(page).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('pipescope-theme')))
    .toBe('dark');

  await themeToggle(page).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pipescope-theme'))).toBeNull();
  await expect(themeToggle(page)).toHaveAttribute('aria-pressed', 'false');
});

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the theme toggle stays in the top right header corner', async ({ page }) => {
    await page.goto('/runs');

    const toggle = await boundingBox(themeToggle(page));
    const brand = await boundingBox(page.getByRole('link', { name: 'PipeScope home' }));
    const nav = await boundingBox(page.getByRole('navigation', { name: 'Primary navigation' }));

    expect(toggle.y + toggle.height / 2).toBeGreaterThan(brand.y);
    expect(toggle.y + toggle.height / 2).toBeLessThan(brand.y + brand.height);
    expect(toggle.y + toggle.height).toBeLessThanOrEqual(nav.y);
    expect(toggle.x + toggle.width).toBeGreaterThan(390 * 0.85);
  });
});

async function boundingBox(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`No bounding box for ${String(locator)}`);
  }
  return box;
}

function themeToggle(page: Page): Locator {
  return page.getByRole('button', { name: 'Dark theme' });
}
