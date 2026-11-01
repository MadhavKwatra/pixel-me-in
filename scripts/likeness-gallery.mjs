// Dev tool: upload each photo in a folder and screenshot the result in every
// look, to judge likeness quickly. Needs the dev server running.
//   node scripts/likeness-gallery.mjs [photoDir] [baseUrl]
// Output: test-results/gallery/<photo>-<size>.png
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = process.argv[2] ?? 'e2e/local-faces';
const base = process.argv[3] ?? 'http://localhost:5190';
const out = 'test-results/gallery';
mkdirSync(out, { recursive: true });

const photos = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
const browser = await chromium.launch();
for (const photo of photos) {
  const name = photo.replace(/\.\w+$/, '');
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('pageerror', (e) => console.log(`[${name}] page error: ${e.message}`));
  await page.goto(base);
  await page.getByRole('button', { name: /play now/i }).click();
  await page.locator('input[type=file]').setInputFiles(join(dir, photo));
  await page.getByRole('heading', { name: 'Line it up' }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await page.locator('.crop-row').screenshot({ path: `${out}/${name}-crop.png` });
  await page.getByRole('button', { name: 'Use this' }).click();
  await page.getByRole('heading', { name: 'Photo Booth' }).waitFor();
  for (const look of ['Pixel', 'Cartoon', 'Photo']) {
    await page.getByRole('button', { name: look, exact: true }).click();
    await page.waitForTimeout(400);
    await page
      .locator('.stage canvas')
      .screenshot({ animations: 'disabled', path: `${out}/${name}-${look.toLowerCase()}.png` });
  }
  console.log(`done ${name}`);
  await page.close();
}

// One overview picture: a row per photo, a column per look.
const cols = ['crop', 'pixel', 'cartoon', 'photo'];
const rows = photos
  .map((p) => p.replace(/\.\w+$/, ''))
  .map(
    (n) =>
      `<tr><td>${n.slice(0, 14)}</td>${cols.map((c) => `<td><img src="${n}-${c}.png" height="150"></td>`).join('')}</tr>`,
  )
  .join('');
writeFileSync(
  `${out}/index.html`,
  `<body style="margin:0;background:#222;color:#fff;font:12px monospace"><table><tr><td></td>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>${rows}</table></body>`,
);
const sheet = await browser.newPage({ viewport: { width: 1200, height: 600 } });
await sheet.goto(pathToFileURL(join(process.cwd(), out, 'index.html')).href);
await sheet.screenshot({ path: `${out}/_sheet.png`, fullPage: true });
await browser.close();
console.log(`overview: ${out}/_sheet.png`);
