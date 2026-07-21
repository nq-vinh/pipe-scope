import { expect, test, type Page } from '@playwright/test';

test('the live stream runs, pauses without advancing, and resumes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/live');

  await expect(page.getByRole('heading', { name: 'Live monitor' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause stream' })).toBeVisible();

  await expect
    .poll(() => metric(page, 'Measured draw FPS'), { timeout: 5_000 })
    .toBeGreaterThan(30);

  const firstFrameCount = await metric(page, 'Frames received');

  await expect
    .poll(() => metric(page, 'Frames received'), { timeout: 3_000 })
    .toBeGreaterThan(firstFrameCount);

  await page.getByRole('button', { name: 'Pause stream' }).click();

  const resumeButton = page.getByRole('button', { name: 'Resume stream' });
  await expect(resumeButton).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(200);

  const frozenFrameCount = await metric(page, 'Frames received');

  await page.waitForTimeout(1_200);
  expect(await metric(page, 'Frames received')).toBe(frozenFrameCount);

  await resumeButton.click();

  await expect
    .poll(() => metric(page, 'Frames received'), { timeout: 3_000 })
    .toBeGreaterThan(frozenFrameCount);
});

test('reduced motion starts the stream paused with an explanation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/live');

  await expect(page.getByRole('note')).toContainText(
    'Reduced motion is enabled, so the live stream starts paused.',
  );
  await expect(page.getByRole('button', { name: 'Resume stream' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('status')).toContainText('Stream paused');
});

async function metric(page: Page, label: string): Promise<number> {
  const text = await page.getByText(new RegExp(`^${label}:\\s*\\d+$`)).textContent();
  const value = text?.match(/:\s*(\d+)/)?.[1];

  if (!value) {
    throw new Error(`Expected a numeric ${label} metric.`);
  }

  return Number(value);
}
