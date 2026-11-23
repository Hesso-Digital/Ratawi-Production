import { expect, test, type Page } from '@playwright/test';

/**
 * Free roam on the hall screen: explore mode, viewpoints, click to inspect,
 * and an /operator cue handing the view back to the show camera.
 */
type Pt = { x: number; y: number };

async function project(page: Page, id: string): Promise<Pt> {
  const pt = await page.evaluate(
    (assetId) => (window as unknown as { __ratawiExplore?: { project: (i: string) => Pt | null } }).__ratawiExplore?.project(assetId) ?? null,
    id,
  );
  if (!pt) throw new Error(`asset ${id} not projectable`);
  return pt;
}

test('explore: orbit, viewpoints, inspect CPF-1 and a wellhead, cue returns to show', async ({ browser }) => {
  const context = await browser.newContext();
  const audience = await context.newPage();
  const errors: string[] = [];
  audience.on('pageerror', (e) => errors.push(e.message));

  await audience.goto('/reveal?quality=low');
  await expect(audience.locator('.reveal-hero .big .n')).toBeVisible({ timeout: 15000 });
  await expect(audience.locator('.explore-bar')).toBeVisible();
  await audience.waitForFunction(() => !!(window as unknown as { __ratawiExplore?: unknown }).__ratawiExplore, null, { timeout: 15000 });

  // Drag on the canvas: free roam takes over.
  const box = (await audience.locator('canvas').first().boundingBox())!;
  await audience.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await audience.mouse.down();
  await audience.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.45, { steps: 8 });
  await audience.mouse.up();
  await expect(audience.locator('.explore-overlay')).toHaveClass(/on/);
  await audience.mouse.wheel(0, -400);

  // Viewpoint 2 (CPF-1), then click CPF-1.
  await audience.keyboard.press('2');
  await audience.waitForTimeout(2200);
  const cpf = await project(audience, 'cpf1');
  await audience.mouse.click(cpf.x, cpf.y);
  await expect(audience.locator('.explore-panel')).toBeVisible();
  await expect(audience.locator('.explore-panel h2')).toHaveText(/CPF-1|RT-/);

  // Esc closes; then inspect an AGUP wellhead from the AGUP viewpoint.
  await audience.keyboard.press('Escape');
  await expect(audience.locator('.explore-panel')).toHaveCount(0);
  await audience.keyboard.press('4');
  await audience.waitForTimeout(2200);
  const well = await project(audience, 'well-RT-63');
  await audience.mouse.click(well.x, well.y);
  await expect(audience.locator('.explore-panel h2')).toHaveText(/RT-/);

  // An operator cue hands control back to the show camera and closes the panel.
  const operator = await context.newPage();
  await operator.goto('/operator');
  await expect(operator.getByRole('button', { name: 'Bring AGUP online' })).toBeVisible();
  await operator.getByRole('button', { name: 'Bring AGUP online' }).click();
  await expect(audience.locator('.explore-panel')).toHaveCount(0, { timeout: 10000 });
  await expect(audience.locator('.explore-overlay')).not.toHaveClass(/on/, { timeout: 10000 });

  expect(errors).toEqual([]);
  await context.close();
});

test('interactive data: KPI drawer, scrubber, well chip flies to the well in 3D', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/reveal?quality=low');
  await expect(page.locator('.reveal-hero .big .n')).toBeVisible({ timeout: 15000 });

  // Panels stay collapsed in show mode.
  await expect(page.locator('.kpi-drawer')).toHaveCount(0);

  // Oil tile opens its drawer (and free roam) with the trend chart and gauge.
  await page.click('.reveal-kpi[data-kpi="oil"]');
  await expect(page.locator('.kpi-drawer[data-kpi="oil"]')).toBeVisible();
  await expect(page.locator('.explore-overlay')).toHaveClass(/on/);
  await expect(page.locator('.kpi-drawer .gauge')).toBeVisible();
  await page.locator('.kpi-drawer input[type="range"]').fill('3');
  await expect(page.locator('.scrub-read b')).toHaveText('Sep');

  // Wells tile: clicking a well chip selects it in 3D and opens its panel.
  await page.click('.reveal-kpi[data-kpi="wells"]');
  await expect(page.locator('.kpi-drawer[data-kpi="wells"] .well-chip')).toHaveCount(32);
  await page.click('.well-chip[data-well="RT-60"]');
  await expect(page.locator('.explore-panel h2')).toHaveText('RT-60');
  await expect(page.locator('.reveal-kpi[data-kpi="wells"]')).toHaveClass(/related/);

  // Back to show collapses the panels.
  await page.keyboard.press('r');
  await expect(page.locator('.kpi-drawer')).toHaveCount(0);
  expect(errors).toEqual([]);
});
