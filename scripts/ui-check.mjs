// Dev tool: screenshots of the main screens (desktop + phone) for a design review.
//   node scripts/ui-check.mjs [baseUrl]   (needs the dev server)
// Output: test-results/ui-*.png
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5190';
mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch();

async function run(name, contextOptions) {
  const ctx = await browser.newContext(contextOptions);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${name}] PAGE ERROR:`, e.message));
  const shot = (s) => page.screenshot({ path: `test-results/ui-${name}-${s}.png` });

  await page.goto(base);
  await page.waitForTimeout(500);
  await shot('landing');
  await page.goto(`${base}/how-to-play.html`);
  await shot('howto-page');

  await page.goto(base);
  await page.getByRole('button', { name: /play now/i }).click();
  await page.waitForTimeout(150);
  await shot('loading');
  await page.getByRole('button', { name: /no photo/i }).click();
  await page.getByRole('button', { name: 'Character 2' }).click();
  await page.getByRole('heading', { name: 'Photo Booth' }).waitFor();
  await page.waitForTimeout(300);
  await shot('booth-look');
  await page.getByRole('tab', { name: 'Hat' }).click();
  await shot('booth-hat');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.waitForTimeout(400);
  await shot('menu');
  await ctx.close();
}

await run('desktop', { viewport: { width: 1280, height: 800 } });
await run('phone', { ...devices['Pixel 7'] });
await browser.close();
console.log('done');
