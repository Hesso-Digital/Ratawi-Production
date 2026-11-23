import { expect, test } from '@playwright/test';

/**
 * Smoke tests + beat screenshots, in the spirit of design-3d/render.mjs:
 * headless Chrome through SwiftShader (no GPU needed), `?frame=F1..F6` deep
 * links reproduce the approved beats deterministically. Screenshots are
 * saved for manual review — this is a
 * visual smoke check, not a pixel-exact regression gate (plan section 8).
 */

test.describe('routes', () => {
  test('/ loads the reveal view by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.reveal-hero .big .n')).toBeVisible({ timeout: 15000 });
  });

  test('/classic loads the SVG dashboard', async ({ page }) => {
    await page.goto('/classic');
    await expect(page.locator('.hero-value')).toBeVisible();
    await expect(page.locator('.field-svg')).toBeVisible();
  });

  test('/fallback loads the minimal 2D fallback', async ({ page }) => {
    await page.goto('/fallback');
    await expect(page.locator('.fallback-stage .hero-value')).toBeVisible();
  });

  test('/operator is PIN-gated', async ({ page }) => {
    await page.goto('/operator');
    await expect(page.locator('input[aria-label="Operator PIN"]')).toBeVisible();
  });
});

test.describe('ceremony beats (approved frames F1–F6)', () => {
  const frames = ['F1', 'F2', 'F2b', 'F3', 'F4', 'F5', 'F6'];

  for (const frame of frames) {
    test(`?frame=${frame} renders and screenshots`, async ({ page }) => {
      await page.goto(`/reveal?frame=${frame}&quality=low`);
      await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
      // Let the scene settle a few frames before capturing.
      await page.waitForTimeout(600);
      await page.screenshot({ path: `e2e/screenshots/${frame}.png` });
    });
  }
});

test('operator cues drive the audience in another tab', async ({ browser }) => {
  const context = await browser.newContext();
  const operator = await context.newPage();
  const audience = await context.newPage();

  await audience.goto('/reveal?quality=low');
  await expect(audience.locator('.reveal-hero .big .n')).toHaveText('105.0', { timeout: 15000 });

  await operator.goto('/operator');
  await operator.fill('input[aria-label="Operator PIN"]', '12026');
  await operator.click('button:has-text("Unlock")');
  await operator.click('button:has-text("Step 1 · Valves open")');

  await expect(audience.locator('.reveal-hero .big .n')).toHaveText('110.0', { timeout: 15000 });

  await operator.click('button:has-text("Countdown")');
  await expect(audience.locator('.reveal-count')).toBeVisible({ timeout: 10000 });
  await expect(audience.locator('.reveal-hud')).toHaveClass(/gold/, { timeout: 40000 });
  await expect(audience.locator('.reveal-hero .big .n')).toHaveText('120.0');

  await context.close();
});

test.describe('wording', () => {
  const forbidden = /\b(dummy|demo|mock|sample|prototype|placeholder|test)\w*/i;

  for (const path of ['/', '/classic', '/fallback', '/operator', '/?frame=F4', '/?frame=F6']) {
    test(`${path} shows none of the banned words and logs no banner`, async ({ page }) => {
      const logs: string[] = [];
      page.on('console', (m) => logs.push(m.text()));
      await page.goto(path);
      await page.waitForTimeout(2500);
      if (path === '/operator') {
        const visible = await page.evaluate(() => document.body.innerText);
        expect(visible).not.toMatch(forbidden);
        await page.fill('input[aria-label="Operator PIN"]', '12026');
        await page.click('button:has-text("Unlock")');
        await page.waitForTimeout(500);
      }
      const text = await page.evaluate(() => document.body.innerText);
      const attrs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[title],[alt],[aria-label],[placeholder]'))
          .map((el) => ['title', 'alt', 'aria-label', 'placeholder'].map((a) => el.getAttribute(a) ?? '').join(' '))
          .join(' '),
      );
      const head = await page.evaluate(() => document.head.innerText + document.title + Array.from(document.querySelectorAll('meta')).map((m) => m.content).join(' '));
      expect(text).not.toMatch(forbidden);
      expect(attrs).not.toMatch(forbidden);
      expect(head).not.toMatch(forbidden);
      expect(logs.filter((l) => forbidden.test(l) && !/WebGL|GL Driver|swiftshader/i.test(l))).toEqual([]);
    });
  }
});
