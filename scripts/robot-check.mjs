// Dev tool: jump to the end of zone 1 and screenshot the Robot Rush.
//   node scripts/robot-check.mjs [baseUrl]   (needs the dev server)
// Output: test-results/robot-*.png
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5190';
mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
const shot = (n) => page.screenshot({ path: `test-results/robot-${n}.png` });
const waitFor = (sel, ms = 30_000) => page.locator(sel).first().waitFor({ timeout: ms });

await page.goto(`${base}/?debug&start=395`);
await page
  .getByRole('button', { name: /play now/i })
  .first()
  .click();
await page.getByRole('button', { name: /no photo/i }).click();
await page.getByRole('button', { name: 'Character 2' }).click();
await page.getByRole('button', { name: 'Play', exact: true }).click();
await page.locator('#hud').waitFor({ state: 'visible', timeout: 10_000 });

await waitFor('.chase');
await page.waitForTimeout(400);
await shot('1-rush');

await waitFor('.hint-laser, .hint-bomb');
const first = (await page.locator('.hint-laser').count()) ? 'laser' : 'bomb';
await page.waitForTimeout(300);
await shot(`2-${first}-warning`);
if (first === 'laser') {
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(700);
  await shot('3-laser-slide');
  await page.keyboard.up('ArrowDown');
} else {
  await page.waitForTimeout(700);
  await shot('3-bomb-landed');
  await page.keyboard.press('Space');
}

// Do nothing: get hit by the next attack -> stumble (robot right behind you).
await waitFor('.chase:has-text("behind")', 20_000).catch(() => console.log('no stumble seen'));
await page.waitForTimeout(300);
await shot('4-stumble');
const second = first === 'laser' ? 'bomb' : 'laser';
await waitFor(`.hint-${second}`, 25_000).catch(() => console.log(`no ${second} seen`));
await page.waitForTimeout(first === 'laser' ? 700 : 300);
await shot(`5-${second}`);
await browser.close();
console.log('done', first);
