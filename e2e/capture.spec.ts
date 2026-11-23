import { expect, test, type Page } from '@playwright/test';

/**
 * Plays the whole ceremony in real time, one operator window and one hall
 * window sharing a browser context, and saves 1920x1080 stills of each stage.
 * Run with: npx playwright test e2e/capture.spec.ts
 */
const OUT = 'docs/screens/after';

async function oilOf(page: Page) {
  return Number((await page.locator('.reveal-hero .big .n').innerText()).replace(',', '.'));
}

/** A hidden tab throttles its animation frames, so each window is brought forward before it is read. */
async function click(operator: Page, hall: Page, name: string) {
  await operator.bringToFront();
  await operator.click(`button:has-text("${name}")`);
  await hall.bringToFront();
}

async function waitForOil(page: Page, predicate: (oil: number) => boolean, timeout = 40_000) {
  await expect.poll(async () => predicate(await oilOf(page)), { timeout, intervals: [50] }).toBe(true);
}

test('ceremony end to end', async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const hall = await context.newPage();
  const operator = await context.newPage();

  await hall.goto('/?quality=medium');
  await hall.bringToFront();
  await expect(hall.locator('.reveal-hero .big .n')).toHaveText('105.0', { timeout: 30_000 });
  await hall.waitForTimeout(1500);
  await hall.screenshot({ path: `${OUT}/01-audience-initial.png` });

  await operator.goto('/operator');
  await operator.bringToFront();
  await expect(operator.getByRole('button', { name: 'Bring AGUP online' })).toBeVisible();
  await operator.screenshot({ path: `${OUT}/02-operator.png` });
  await operator.screenshot({ path: `${OUT}/03-operator-unlocked.png` });

  await click(operator, hall, 'Bring AGUP online');
  await waitForOil(hall, (o) => o >= 119.95);
  await expect(hall.locator('.reveal-hud')).toHaveClass(/gold/, { timeout: 15_000 });
  await expect(hall.locator('.reveal-steps')).toHaveCount(0);
  await expect(hall.locator('.reveal-count')).toHaveCount(0);
  await hall.waitForTimeout(400);
  await hall.screenshot({ path: `${OUT}/07-audience-gold-120.png` });
  await hall.screenshot({ path: `${OUT}/08-audience-after-step2.png` });
  await operator.bringToFront();
  await operator.waitForTimeout(300);
  await operator.screenshot({ path: `${OUT}/09-operator-after-agup.png` });

  await click(operator, hall, 'Play replay');
  await expect(hall.locator('.reveal-playback')).toHaveCount(0);
  await waitForOil(hall, (o) => o > 20 && o < 100);
  await hall.screenshot({ path: `${OUT}/10-audience-mid-replay.png` });
  await waitForOil(hall, (o) => o >= 119.95);
  await hall.waitForTimeout(2500);
  await hall.screenshot({ path: `${OUT}/11-audience-after-replay.png` });

  await click(operator, hall, 'Reset to current');
  await expect(hall.locator('.reveal-hero .big .n')).toHaveText('105.0', { timeout: 10_000 });
  await hall.waitForTimeout(2500);
  await hall.screenshot({ path: `${OUT}/12-audience-after-reset.png` });

  await context.close();
});

test('hall view has no countdown chrome at F2b', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?frame=F2b');
  await expect(page.locator('.reveal-hero .big .n')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.reveal-count')).toHaveCount(0);
  await expect(page.locator('.reveal-steps')).toHaveCount(0);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/05-audience-f2b.png` });
});

test('close-up on CPF-1 and AG-25 (F5)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?frame=F5');
  await expect(page.locator('.reveal-hero .big .n')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/13-audience-closeup-f5.png` });
});
