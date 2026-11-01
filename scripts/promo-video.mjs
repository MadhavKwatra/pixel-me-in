// Dev tool: record short promo videos of the real game (with captions).
//   node scripts/promo-video.mjs [photo] [baseUrl] [landscape|vertical]   (needs the dev server)
// Output: promo/videos/pixel-me-in-landscape.mp4 and -vertical.mp4 (needs ffmpeg;
// otherwise the .webm files). Uses the owner's own photo (consent) – never commit the videos.
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const photo = process.argv[2] ?? 'e2e/local-faces/myPhoto.jpg';
const base = process.argv[3] ?? 'http://localhost:5190';
const out = 'promo/videos';
mkdirSync(out, { recursive: true });

const FORMATS = {
  landscape: {
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: out, size: { width: 1280, height: 720 } },
  },
  // Recorded at 540×960 (a phone layout) and scaled ×2 to 1080×1920 with crisp pixels:
  // Playwright does not upscale, it would pad a small page inside a big frame.
  vertical: {
    ...devices['Pixel 7'],
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 1,
    recordVideo: { dir: out, size: { width: 540, height: 960 } },
  },
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function record(name, opts) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${name}] PAGE ERROR:`, e.message));
  const big = name === 'landscape';

  // Caption on top of the page (part of the recording).
  const caption = (text) =>
    page.evaluate(
      ([t, big]) => {
        let el = document.getElementById('promo-cap');
        if (!el) {
          el = document.createElement('div');
          el.id = 'promo-cap';
          el.style.cssText = `position:fixed;left:50%;top:${big ? 14 : 9}%;transform:translateX(-50%);z-index:9999;
            font:700 ${big ? 34 : 22}px "Pixelify Sans",monospace;color:#14121c;background:#e8c547;
            border:4px solid #14121c;box-shadow:6px 6px 0 #14121c;padding:10px 18px;text-align:center;
            max-width:90vw;pointer-events:none`;
          document.body.append(el);
        }
        el.textContent = t;
        el.style.display = t ? 'block' : 'none';
      },
      [text, big],
    );

  await page.goto(`${base}/?demo&start=372&autopilot=15`);
  await wait(600);
  await caption('Put YOUR face in a pixel-art game');
  await wait(2600);

  await page
    .getByRole('button', { name: /play now/i })
    .first()
    .click();
  await page.getByRole('button', { name: /no photo/i }).waitFor();
  await caption('Snap a selfie – it never leaves your phone');
  await wait(1400);
  await page.locator('input[type=file]').setInputFiles(photo);
  await page.getByRole('heading', { name: 'Line it up' }).waitFor({ timeout: 60_000 });
  await caption('Background and neck: cut out on your device');
  await wait(2200);

  await page.getByRole('button', { name: 'Use this' }).click();
  await page.getByRole('heading', { name: 'Photo Booth' }).waitFor();
  await caption('Pick your look');
  await wait(1000);
  for (const look of ['Cartoon', 'Photo', 'Pixel']) {
    await page.getByRole('button', { name: look, exact: true }).click();
    await wait(800);
  }
  await page.getByRole('tab', { name: 'Hat' }).click();
  await page.getByRole('button', { name: 'Cap' }).click();
  await wait(900);
  await page.getByRole('tab', { name: 'Face' }).click();
  await page.getByRole('button', { name: 'Sunglasses' }).click();
  await wait(1100);

  await caption('');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.locator('#hud').waitFor({ state: 'visible', timeout: 15_000 });
  await caption('Run, jump, slide…');
  await wait(2200);
  await caption('');
  await page
    .locator('.chase')
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  await caption('…and dodge the robot!');
  await wait(2000);
  await caption('');
  await page.getByRole('heading', { name: 'Zapped out!' }).waitFor({ timeout: 60_000 });
  await wait(600);
  await caption('Challenge your friends');
  await page.getByRole('button', { name: 'Challenge friends' }).click();
  await wait(2200);

  // End card
  await page.evaluate((big) => {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:16px;background:#1b1f3b;color:#f4f1e8;font-family:"Pixelify Sans",monospace;text-align:center`;
    el.innerHTML = `<div style="font-size:${big ? 72 : 48}px;color:#e8c547;text-shadow:5px 5px 0 #14121c">Pixel Me In</div>
      <div style="font-size:${big ? 30 : 22}px">Free · in your browser · no install</div>
      <div style="font-size:${big ? 24 : 18}px;opacity:.8">Your photo stays on your device</div>`;
    document.body.append(el);
  }, big);
  await wait(2500);

  const video = page.video();
  await ctx.close();
  await browser.close();
  const webm = join(out, `pixel-me-in-${name}.webm`);
  rmSync(webm, { force: true });
  renameSync(await video.path(), webm);
  try {
    const mp4 = webm.replace('.webm', '.mp4');
    const scale = name === 'vertical' ? ['-vf', 'scale=1080:1920:flags=neighbor'] : [];
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      webm,
      ...scale,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '20',
      '-movflags',
      '+faststart',
      mp4,
    ]);
    console.log(`wrote ${mp4}`);
  } catch {
    console.log(`wrote ${webm} (ffmpeg not available for MP4)`);
  }
}

const only = process.argv[4];
for (const [name, opts] of Object.entries(FORMATS))
  if (!only || only === name) await record(name, opts);
// Clean up stray recordings Playwright may leave behind.
for (const f of readdirSync(out)) if (/^[0-9a-f]{32}\.webm$/.test(f)) rmSync(join(out, f));
