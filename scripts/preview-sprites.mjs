// Dev tool: draw every body frame (all outfits) big, to check animations.
//   node scripts/preview-sprites.mjs [baseUrl]   (needs the dev server)
// Output: test-results/sprites.png
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5190';
mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2260, height: 760 } });
page.on('pageerror', (e) => console.log('page error:', e.message));
await page.goto(base);
await page.evaluate(async () => {
  const body = await import('/src/art/body.ts');
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;background:#7ec8f2;';
  const scale = 4;
  for (const outfit of Object.keys(body.OUTFIT_LABELS)) {
    const sheet = body.drawBodySheet(outfit, '#c68642');
    const c = document.createElement('canvas');
    c.width = sheet.width * scale;
    c.height = sheet.height * scale;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, 0, 0, c.width, c.height);
    // red dot = neck point
    body.BODY_FRAMES.forEach((f, i) => {
      const n = body.NECK[f];
      ctx.fillStyle = 'red';
      ctx.fillRect((i * body.BODY_W + n.x) * scale, n.y * scale, scale, scale);
    });
    c.style.cssText = 'display:block;margin:4px;image-rendering:pixelated';
    document.body.append(c);
  }
});
await page.screenshot({ path: 'test-results/sprites.png', fullPage: true });
await browser.close();
console.log('wrote test-results/sprites.png');
