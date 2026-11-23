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
  await operator.screenshot({ path: `${OUT}/02-operator-locked.png` });
  await operator.fill('input[aria-label="Operator PIN"]', '12026');
  await operator.click('button:has-text("Unlock")');
  await expect(operator.locator('button:has-text("Step 1")').first()).toBeVisible();
  await operator.screenshot({ path: `${OUT}/03-operator-unlocked.png` });

  await click(operator, hall, '1 · Step 1');
  await waitForOil(hall, (o) => o >= 109.95);
  await hall.waitForTimeout(2500);
  await hall.screenshot({ path: `${OUT}/04-audience-after-step1.png` });

  await click(operator, hall, '2 · Countdown');
  await expect(hall.locator('.reveal-count')).toBeVisible({ timeout: 10_000 });
  await expect(hall.locator('.reveal-count')).toBeHidden({ timeout: 10_000 });
  await hall.screenshot({ path: `${OUT}/06-audience-after-countdown.png` });

  await waitForOil(hall, (o) => o >= 119.95);
  await hall.waitForTimeout(400);
  await hall.screenshot({ path: `${OUT}/07-audience-gold-120.png` });

  await hall.waitForTimeout(4500);
  await hall.screenshot({ path: `${OUT}/08-audience-after-step2.png` });
  await operator.bringToFront();
  await operator.waitForTimeout(300);
  await operator.screenshot({ path: `${OUT}/09-operator-after-step2.png` });

  await click(operator, hall, 'Replay June to December');
  await expect(hall.locator('.reveal-playback')).toBeVisible({ timeout: 10_000 });
  await waitForOil(hall, (o) => o > 60 && o < 100);
  await hall.screenshot({ path: `${OUT}/10-audience-mid-replay.png` });
  await expect(hall.locator('.reveal-playback .k')).toContainText('Dec', { timeout: 20_000 });
  await waitForOil(hall, (o) => o >= 119.95);
  await hall.waitForTimeout(2500);
  await hall.screenshot({ path: `${OUT}/11-audience-after-replay.png` });

  await click(operator, hall, 'Reset');
  await expect(hall.locator('.reveal-hero .big .n')).toHaveText('105.0', { timeout: 10_000 });
  await hall.waitForTimeout(2500);
  await hall.screenshot({ path: `${OUT}/12-audience-after-reset.png` });

  await context.close();
});

test('countdown on the 2', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?frame=F2b');
  await expect(page.locator('.reveal-count')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/05-audience-countdown.png` });
});

test('close-up on CPF-1 and AG-25 (F5)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?frame=F5');
  await expect(page.locator('.reveal-hero .big .n')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/13-audience-closeup-f5.png` });
});
