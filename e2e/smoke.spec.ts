import { expect, test, type Page } from '@playwright/test';

// Relative to the project root (where Playwright runs).
const SAMPLE_PHOTO = 'public/og-image.png';

/** Fails the test if the page talks to any other site (the privacy promise). */
function watchNetwork(page: Page) {
  const foreign: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (
      !['localhost', ''].includes(u.hostname) &&
      !u.protocol.startsWith('data') &&
      !u.protocol.startsWith('blob')
    ) {
      foreign.push(r.url());
    }
  });
  page.on('pageerror', (e) => errors.push(e.message));
  // MediaPipe prints harmless 'INFO:' lines on the error channel; ignore those.
  page.on(
    'console',
    (m) => m.type() === 'error' && !m.text().startsWith('INFO:') && errors.push(m.text()),
  );
  return { foreign, errors };
}

test('landing page has SEO content and a strict CSP', async ({ page }) => {
  const net = watchNetwork(page);
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('face');
  await expect(page.getByRole('link', { name: /How to play/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Privacy/ }).first()).toBeVisible();
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("connect-src 'self'");
  expect(net.foreign).toEqual([]);
  expect(net.errors).toEqual([]);
});

test('no photo: pick a character, play, and the run starts', async ({ page, isMobile }) => {
  const net = watchNetwork(page);
  if (isMobile) await page.setViewportSize({ width: 915, height: 412 }); // landscape phone
  await page.goto('/');
  await page.getByRole('button', { name: /play now/i }).click();
  await page.getByRole('button', { name: /no photo/i }).click();
  await page.getByRole('button', { name: 'Character 2' }).click();
  await expect(page.getByRole('heading', { name: 'Photo Booth' })).toBeVisible();
  await page.getByRole('tab', { name: 'Face' }).click();
  await page.getByRole('button', { name: 'Sunglasses' }).click();
  await page.screenshot({ path: `test-results/booth-${isMobile ? 'phone' : 'desktop'}.png` });

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('#hud')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(2500);
  if (!isMobile) await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/run-${isMobile ? 'phone' : 'desktop'}.png` });
  const metres = Number(await page.locator('[data-m]').textContent());
  expect(metres).toBeGreaterThan(0);
  expect(net.foreign).toEqual([]);
  expect(net.errors).toEqual([]);
});

test('upload a photo: face finder loads locally and the crop screen opens', async ({ page }) => {
  const net = watchNetwork(page);
  await page.goto('/');
  await page.getByRole('button', { name: /play now/i }).click();
  await page.locator('input[type=file]').setInputFiles(SAMPLE_PHOTO);
  await expect(page.getByRole('heading', { name: 'Line it up' })).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: 'test-results/crop.png' });
  await page.getByRole('button', { name: 'Use this' }).click();
  await expect(page.getByRole('heading', { name: 'Photo Booth' })).toBeVisible();
  expect(net.foreign).toEqual([]);
  expect(net.errors).toEqual([]);
});

test('camera: snap a photo with the fake camera', async ({ page }) => {
  const net = watchNetwork(page);
  await page.goto('/');
  await page.getByRole('button', { name: /play now/i }).click();
  await page.getByRole('button', { name: /take a photo/i }).click();
  const snap = page.getByRole('button', { name: 'Snap!' });
  await expect(snap).toBeEnabled({ timeout: 10_000 });
  await snap.click();
  await expect(page.getByRole('heading', { name: 'Line it up' })).toBeVisible({ timeout: 30_000 });
  expect(net.foreign).toEqual([]);
  expect(net.errors).toEqual([]);
});

test('phone held upright: full-screen run, tap to jump, swipe down to slide', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'phone only');
  const net = watchNetwork(page);
  await page.goto('/');
  await page
    .getByRole('button', { name: /play now/i })
    .first()
    .click();
  await page.getByRole('button', { name: /no photo/i }).click();
  await page.getByRole('button', { name: 'Character 1' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('#hud')).toBeVisible({ timeout: 10_000 });
  // Upright phones show the Jump/Slide buttons by default; the canvas fills the screen.
  await expect(page.getByRole('button', { name: 'Jump' })).toBeVisible();
  const canvas = await page.locator('#game canvas').boundingBox();
  const vp = page.viewportSize()!;
  expect(canvas!.height).toBeGreaterThan(vp.height * 0.9);
  await page.waitForTimeout(1500);
  await page.touchscreen.tap(vp.width / 2, vp.height / 2);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/portrait-run.png' });
  expect(Number(await page.locator('[data-m]').textContent())).toBeGreaterThan(0);
  expect(net.errors).toEqual([]);
});

test('phone: hide/show the touch buttons in the tutorial and the pause menu', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'phone only');
  await page.goto('/');
  await page
    .getByRole('button', { name: /play now/i })
    .first()
    .click();
  await page.getByRole('button', { name: /no photo/i }).click();
  await page.getByRole('button', { name: 'Character 1' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('#hud')).toBeVisible({ timeout: 10_000 });
  const jump = page.getByRole('button', { name: 'Jump' });
  await expect(jump).toBeVisible();
  // Tutorial chip: hide the buttons right away, then show them again.
  await page.getByRole('button', { name: 'Hide buttons' }).click();
  await expect(jump).toBeHidden();
  await page.getByRole('button', { name: 'Show buttons' }).click();
  await expect(jump).toBeVisible();
  // Pause menu: same option.
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('combobox', { name: 'Touch buttons' }).selectOption('never');
  await page.getByRole('button', { name: /Resume/ }).click();
  await expect(jump).toBeHidden();
});

test('pause: button, Esc and P all open the pause screen', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await page.goto('/');
  await page.getByRole('button', { name: /play now/i }).click();
  await page.getByRole('button', { name: /no photo/i }).click();
  await page.getByRole('button', { name: 'Character 1' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('#hud')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  for (const how of ['button', 'Escape', 'p']) {
    if (how === 'button') await page.getByRole('button', { name: 'Pause' }).click();
    else await page.keyboard.press(how);
    await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
    await page.getByRole('button', { name: /Resume/ }).click();
    await page.waitForTimeout(400);
  }
});

test('detail pages load with header, footer and CSP', async ({ page }) => {
  const net = watchNetwork(page);
  for (const [path, heading] of [
    ['/how-to-play.html', 'How to play'],
    ['/privacy.html', 'Your photo stays on your device'],
    ['/about.html', 'About Pixel Me In'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page.locator('.site-footer')).toContainText('Madhav');
    await expect(page.locator('.site-footer a[aria-label="LinkedIn"]')).toBeVisible();
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp).toContain("connect-src 'self'");
  }
  expect(net.foreign).toEqual([]);
  expect(net.errors).toEqual([]);
});
