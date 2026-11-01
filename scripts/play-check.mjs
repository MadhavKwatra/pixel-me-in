// Dev tool: play a first run (tutorial) and take screenshots of key moments.
//   node scripts/play-check.mjs [baseUrl]   (needs the dev server)
// Output: test-results/play-*.png, plus any page errors on the console.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5190';
const out = 'test-results';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on(
  'console',
  (m) =>
    m.type() === 'error' &&
    !m.text().startsWith('INFO:') &&
    console.log('console error:', m.text()),
);
const shot = async (name) => {
  await page.screenshot({ path: `${out}/play-${name}.png` });
  // Zoomed view of the player.
  await page.screenshot({
    path: `${out}/play-${name}-zoom.png`,
    clip: { x: 200, y: 330, width: 240, height: 290 },
  });
};
const hint = (cls) => page.locator(`.hint-${cls}`).waitFor({ timeout: 20_000 });

await page.goto(base);
await page.getByRole('button', { name: /play now/i }).click();
await page.getByRole('button', { name: /no photo/i }).click();
await page.getByRole('button', { name: 'Character 3' }).click();
await page.getByRole('button', { name: /▶ Play/ }).click();
await page.locator('#hud').waitFor({ state: 'visible', timeout: 10_000 });
await shot('1-ready');

await hint('jump');
await page.waitForTimeout(300);
await shot('2-lesson-jump');
await page.keyboard.down('Space');
await page.waitForTimeout(200);
await shot('3-jumping');
await page.keyboard.up('Space');

await hint('slide');
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(250);
await shot('4-sliding');
await page.keyboard.up('ArrowDown');

await hint('double');
await page.keyboard.press('Space');
await page.waitForTimeout(220);
await page.keyboard.press('Space');
await page.waitForTimeout(150);
await shot('5-double-jump');

await hint('power');
await page.waitForTimeout(1500);
await shot('6-power');

// Stop pressing anything until we crash.
await page.waitForTimeout(6000);
await shot('7-running');
const over = page.getByRole('heading', { name: 'Zapped out!' });
for (let i = 0; i < 80 && !(await over.isVisible().catch(() => false)); i++) {
  await page.waitForTimeout(100);
  if (i === 2 || i === 6) await shot(`8-crash-${i}`);
}
await shot('9-game-over');
await browser.close();
console.log('done');
