import { expect, test, type Locator } from '@playwright/test';

test('overview loads deterministic inspection data and filters by segment', async ({ page }) => {
  await page.goto('/runs');

  await expect(page.getByRole('heading', { name: 'Inspection runs' })).toBeVisible();

  const table = page.getByRole('table', { name: 'Inspection runs' });
  const initialRowCount = (await table.getByRole('row').count()) - 1;

  expect(initialRowCount).toBeGreaterThan(1);

  await page.getByLabel('Search segment').fill('Elbe Crossing North');

  await expect
    .poll(async () => (await table.getByRole('row').count()) - 1)
    .toBeLessThan(initialRowCount);

  const filteredRows = table.getByRole('row');
  const filteredRowCount = await filteredRows.count();

  expect(filteredRowCount).toBeGreaterThan(1);

  for (let index = 1; index < filteredRowCount; index += 1) {
    await expect(filteredRows.nth(index)).toContainText('Elbe Crossing North');
  }
});

test('sorting by anomaly count reorders the overview rows', async ({ page }) => {
  await page.goto('/runs');

  const table = page.getByRole('table', { name: 'Inspection runs' });
  const before = await anomalyCounts(table);
  const sortButton = page.getByRole('button', { name: /Anomalies/ });
  const sortHeader = table.getByRole('columnheader', { name: /Anomalies/ });

  await sortButton.click();
  await expect(sortHeader).toHaveAttribute('aria-sort', 'ascending');

  const ascending = await anomalyCounts(table);
  expect(ascending).toEqual([...ascending].sort((first, second) => first - second));
  expect(ascending).not.toEqual(before);

  await sortButton.click();
  await expect(sortHeader).toHaveAttribute('aria-sort', 'descending');

  const descending = await anomalyCounts(table);
  expect(descending).toEqual([...descending].sort((first, second) => second - first));
});

test('a run row link opens its detail page with map markers', async ({ page }) => {
  await page.goto('/runs');

  const rowLink = page.getByRole('link', { name: /Open inspection run/ }).first();
  const runId = (await rowLink.textContent())?.trim();

  if (!runId) {
    throw new Error('Expected the first run row to expose its run id.');
  }

  await rowLink.click();

  await expect(page).toHaveURL(new RegExp(`/runs/${runId}$`));
  await expect(page.getByRole('heading', { name: runId, exact: true })).toBeVisible();

  const map = page.getByRole('group', { name: /pipeline map/i });

  await expect(map).toBeVisible();
  expect(await map.getByRole('button').count()).toBeGreaterThan(0);
});

async function anomalyCounts(table: Locator): Promise<number[]> {
  const rows = table.getByRole('row');
  const rowCount = await rows.count();
  const values: number[] = [];

  for (let index = 1; index < rowCount; index += 1) {
    const text = await rows.nth(index).getByRole('cell').nth(4).textContent();
    values.push(Number(text?.trim()));
  }

  return values;
}
