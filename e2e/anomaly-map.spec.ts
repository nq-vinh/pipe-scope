import { expect, test } from '@playwright/test';

interface MarkerDetails {
  readonly confidence: string;
  readonly severity: string;
  readonly type: string;
}

test('keyboard marker selection is deep-linked and restored with an equivalent table fallback', async ({
  page,
}) => {
  await page.goto('/runs/run-20260720-1');

  const map = page.getByRole('group', { name: /pipeline map/i });
  const markers = map.getByRole('button');
  const markerCount = await markers.count();

  expect(markerCount).toBeGreaterThan(1);

  const main = page.getByRole('main');
  const firstMarker = markers.first();
  const secondMarker = markers.nth(1);

  await main.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /Back to runs/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(firstMarker).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(secondMarker).toBeFocused();

  const details = markerDetails(await secondMarker.getAttribute('aria-label'));

  await page.keyboard.press('Enter');

  await expect.poll(() => new URL(page.url()).searchParams.get('anomaly')).not.toBeNull();

  const anomalyId = new URL(page.url()).searchParams.get('anomaly');

  if (!anomalyId) {
    throw new Error('Expected marker selection to update the anomaly query parameter.');
  }

  await expect(secondMarker).toHaveAttribute('aria-pressed', 'true');

  const panel = page.getByRole('region', { name: details.type });

  await expect(panel.getByRole('heading', { name: details.type })).toBeVisible();
  await expect(panel.getByText(details.severity, { exact: true })).toBeVisible();
  await expect(panel.getByRole('strong')).toHaveText(`${details.confidence}%`);
  await expect(panel.locator('meter')).toBeVisible();
  await expect(panel.getByRole('img', { name: /Ultrasound heatmap for/ })).toBeVisible();

  await page.reload();

  await expect.poll(() => new URL(page.url()).searchParams.get('anomaly')).toBe(anomalyId);
  await expect(map.getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: details.type })).toBeVisible();

  await page.getByText('View as table', { exact: true }).click();

  const anomalyTable = page.getByRole('table', { name: 'Pipeline anomalies' });
  await expect(anomalyTable).toBeVisible();
  await expect(anomalyTable.getByRole('row')).toHaveCount(markerCount + 1);
});

function markerDetails(label: string | null): MarkerDetails {
  if (!label) {
    throw new Error('Expected the focused marker to have an accessible label.');
  }

  const match = /^(.*), (low|medium|high|critical) severity, at .*, (\d+) % confidence$/.exec(
    label,
  );

  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error(`Unexpected marker label: ${label}`);
  }

  return {
    type: match[1],
    severity: match[2],
    confidence: match[3],
  };
}
