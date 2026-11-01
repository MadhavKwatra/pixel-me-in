// Dev tool: open the share sheet, save both picture sizes, and open a challenge link.
//   node scripts/share-check.mjs [baseUrl]   (needs the dev server)
// Output: test-results/share-*.png
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5190';
mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

await page.goto(`${base}/?beat=1234`);
await page.waitForTimeout(300);
await page.screenshot({ path: 'test-results/share-challenge-landing.png' });

await page
  .getByRole('button', { name: /play now/i })
  .first()
  .click();
await page.getByRole('button', { name: /no photo/i }).click();
await page.getByRole('button', { name: 'Character 4' }).click();
await page.getByRole('heading', { name: 'Photo Booth' }).waitFor();
await page.getByRole('button', { name: 'Share', exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'test-results/share-sheet.png' });

for (const size of ['Story size', 'Square']) {
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: size }).click(),
  ]);
  await dl.saveAs(`test-results/share-card-${size.split(' ')[0].toLowerCase()}.png`);
}
await browser.close();
console.log('done');
