// Dev tool: screenshots of every page and game screen at phone, phone-landscape
// and desktop sizes, for a design review (mobile first).
//   node scripts/ui-check.mjs [baseUrl] [onlySize]   (needs the dev server)
// Output: test-results/ui/<size>-<screen>.png
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5190';
const only = process.argv[3];
const out = 'test-results/ui';
mkdirSync(out, { recursive: true });

const SIZES = {
  small: {
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
  iphone: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
  pixel: {
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
  landscape: {
    viewport: { width: 915, height: 412 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
  desktop: { viewport: { width: 1280, height: 800 } },
};

const browser = await chromium.launch();
for (const [size, opts] of Object.entries(SIZES)) {
  if (only && only !== size) continue;
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${size}] PAGE ERROR:`, e.message));
  const shot = (name, full = false) =>
    page.screenshot({ path: `${out}/${size}-${name}.png`, fullPage: full });
  // Fail loudly if anything scrolls sideways (a classic mobile bug).
  const checkOverflow = async (name) => {
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    if (over > 1) console.log(`[${size}] ${name}: page is ${over}px wider than the screen`);
  };

  for (const [name, path] of [
    ['landing', '/'],
    ['howto', '/how-to-play.html'],
    ['privacy', '/privacy.html'],
    ['about', '/about.html'],
  ]) {
    await page.goto(base + path);
    await page.waitForTimeout(300);
    await shot(name);
    await shot(`${name}-full`, true);
    await checkOverflow(name);
  }
  const menuBtn = page.locator('.menu-btn');
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    await shot('nav-open');
    await menuBtn.click();
  }

  // Game screens
  await page.goto(base);
  await page
    .getByRole('button', { name: /play now/i })
    .first()
    .click();
  await page.getByRole('button', { name: /no photo/i }).click();
  await shot('photo-choose');
  await page.getByRole('button', { name: 'Character 2' }).click();
  await page.getByRole('heading', { name: 'Photo Booth' }).waitFor();
  await page.waitForTimeout(300);
  await shot('booth');
  await page.getByRole('tab', { name: 'Hat' }).click();
  await shot('booth-hat');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.waitForTimeout(300);
  await shot('menu');
  await page.getByRole('button', { name: 'Settings' }).click();
  await shot('settings');
  await shot('settings-full', true);
  await ctx.close();
  console.log(`done ${size}`);
}
await browser.close();
