// Dev tool: turn the creator's photo into several pixel-character variants,
// so the owner can pick the one shown on the landing page.
//   node scripts/creator-variants.mjs [photo] [baseUrl] [--export N]   (needs the dev server)
// Output: test-results/creator/variants.png (+ crop.png). The photo itself stays local.
// --export N also writes variant N's 8 run frames to public/brand/creator-run.png
// (pixel art only – that file is committed and shown on the landing page).
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv
  .slice(2)
  .filter((a, i, all) => a !== '--export' && all[i - 1] !== '--export');
const exportAt = process.argv.indexOf('--export');
const exportN = exportAt > 0 ? Number(process.argv[exportAt + 1]) : 0;
const photo = args[0] ?? 'e2e/local-faces/myPhoto.jpg';
const base = args[1] ?? 'http://localhost:5190';
const out = 'test-results/creator';
mkdirSync(out, { recursive: true });

export const VARIANTS = [
  { name: '1 Pixel · T-shirt', style: 'pixel', outfit: 'tee' },
  { name: '2 Pixel · Hoodie', style: 'pixel', outfit: 'hoodie' },
  { name: '3 Pixel · Cap', style: 'pixel', outfit: 'tee', hat: 'cap' },
  { name: '4 Pixel · Shades + skater', style: 'pixel', outfit: 'skater', faceAcc: 'sunglasses' },
  {
    name: '5 Pixel · Dev (lab coat + headphones)',
    style: 'pixel',
    outfit: 'labcoat',
    hat: 'headphones',
  },
  { name: '6 Cartoon · T-shirt', style: 'cartoon', outfit: 'tee' },
  {
    name: '7 Cartoon · Hoodie + headphones',
    style: 'cartoon',
    outfit: 'hoodie',
    hat: 'headphones',
  },
  { name: '8 Photo · T-shirt', style: 'original', outfit: 'tee' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
await page.goto(base);
await page
  .getByRole('button', { name: /play now/i })
  .first()
  .click();
await page.locator('input[type=file]').setInputFiles(photo);
await page.getByRole('heading', { name: 'Line it up' }).waitFor({ timeout: 60_000 });
await page.waitForTimeout(800);
await page.locator('.crop-row').screenshot({ path: `${out}/crop.png` });
await page.getByRole('button', { name: 'Use this' }).click();
await page.getByRole('heading', { name: 'Photo Booth' }).waitFor();

const dataUrl = await page.evaluate(async (variants) => {
  const { loadAvatar } = await import('/src/face/faceStore.ts');
  const { loadFace, renderFrames } = await import('/src/face/renderAvatar.ts');
  const avatar = await loadAvatar();
  const face = await loadFace(avatar);
  const scale = 4;
  const cellW = 360;
  const cellH = 440;
  const cols = 4;
  const sheet = document.createElement('canvas');
  sheet.width = cellW * cols;
  sheet.height = cellH * Math.ceil(variants.length / cols);
  const ctx = sheet.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#1b1f3b';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  variants.forEach((v, i) => {
    const cfg = {
      ...avatar,
      style: { ...avatar.style, style: v.style },
      outfit: v.outfit,
      hat: v.hat ?? null,
      faceAcc: v.faceAcc ?? null,
    };
    const [frame] = renderFrames(face, cfg, scale, ['run1']);
    const x = (i % cols) * cellW;
    const y = Math.floor(i / cols) * cellH;
    ctx.fillStyle = '#7ec8f2';
    ctx.fillRect(x + 8, y + 8, cellW - 16, cellH - 60);
    ctx.drawImage(frame, x + (cellW - frame.width) / 2, y + cellH - 60 - frame.height);
    ctx.fillStyle = '#f4f1e8';
    ctx.font = '600 18px sans-serif';
    ctx.fillText(v.name, x + 12, y + cellH - 24);
  });
  return sheet.toDataURL('image/png');
}, VARIANTS);
writeFileSync(`${out}/variants.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));

if (exportN) {
  const sheetUrl = await page.evaluate(
    async (v) => {
      const { loadAvatar } = await import('/src/face/faceStore.ts');
      const { loadFace, renderFrames } = await import('/src/face/renderAvatar.ts');
      const { RUN_FRAMES } = await import('/src/art/body.ts');
      const avatar = await loadAvatar();
      const face = await loadFace(avatar);
      const cfg = {
        ...avatar,
        style: { ...avatar.style, style: v.style },
        outfit: v.outfit,
        hat: v.hat ?? null,
        faceAcc: v.faceAcc ?? null,
      };
      const frames = renderFrames(face, cfg, 1, RUN_FRAMES);
      const c = document.createElement('canvas');
      c.width = frames[0].width * frames.length;
      c.height = frames[0].height;
      const ctx = c.getContext('2d');
      frames.forEach((f, i) => ctx.drawImage(f, i * f.width, 0));
      return c.toDataURL('image/png');
    },
    VARIANTS[exportN - 1],
  );
  mkdirSync('public/brand', { recursive: true });
  writeFileSync('public/brand/creator-run.png', Buffer.from(sheetUrl.split(',')[1], 'base64'));
  console.log(`exported variant ${exportN} to public/brand/creator-run.png`);
}
await browser.close();
console.log(`wrote ${out}/variants.png and ${out}/crop.png`);
