// Dev tool: draw the social preview image (1200×630) from the real game art:
// the desk zone, the maker's pixel character, RAM sticks and The Utilizer.
//   node scripts/og-image.mjs [baseUrl]   (needs `npm run dev`)
// Output: public/og-image.png (used by the link previews on every page).
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5190';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
await page.goto(`${base}/about.html`);
await page.evaluate(() => document.fonts.ready);

const dataUrl = await page.evaluate(async () => {
  const { ZONES, LAYER_SIZE, GROUND_TILE, SPRITES, paint } = await import('/src/art/world.ts');
  const { drawRobotSheet, ROBOT_W, ROBOT_H, ROBOT_FRAMES } = await import('/src/art/robot.ts');
  const desk = ZONES[0];

  // 1) The scene at game resolution (600×315), then scaled ×2 with crisp pixels.
  const W = 600;
  const H = 315;
  const G = 255; // ground line
  const low = document.createElement('canvas');
  low.width = W;
  low.height = H;
  const c = low.getContext('2d');
  c.drawImage(paint(W, H, desk.sky), 0, 0);
  const far = paint(LAYER_SIZE.w, LAYER_SIZE.h, desk.far);
  const mid = paint(LAYER_SIZE.w, LAYER_SIZE.h, desk.mid);
  const ground = paint(GROUND_TILE.w, GROUND_TILE.h, desk.ground);
  for (let x = -120; x < W; x += LAYER_SIZE.w) c.drawImage(far, x, G - LAYER_SIZE.h - 20);
  for (let x = -60; x < W; x += LAYER_SIZE.w) c.drawImage(mid, x, G - LAYER_SIZE.h + 10);
  for (let x = 0; x < W; x += GROUND_TILE.w) c.drawImage(ground, x, G);

  // The Utilizer, mid-stomp, chasing from the left
  const robot = drawRobotSheet();
  const fi = ROBOT_FRAMES.indexOf('walk2');
  c.drawImage(robot, fi * ROBOT_W, 0, ROBOT_W, ROBOT_H, 18, G - ROBOT_H + 2, ROBOT_W, ROBOT_H);

  // The maker's pixel character, running
  const img = new Image();
  img.src = '/brand/creator-run.png';
  await img.decode();
  const fw = img.width / 8;
  c.drawImage(img, 3 * fw, 0, fw, img.height, 150, G - img.height + 2, fw, img.height);

  // RAM sticks in an arc ahead of the player, one rare RGB stick
  const ram = paint(SPRITES.ram.w, SPRITES.ram.h, SPRITES.ram.draw);
  const rgb = paint(SPRITES.ramRgb.w, SPRITES.ramRgb.h, SPRITES.ramRgb.draw);
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    c.drawImage(i === 3 ? rgb : ram, 236 + i * 30, G - 62 - 46 * Math.sin(t * Math.PI));
  }

  // 2) Upscale and add the title in the game font.
  const out = document.createElement('canvas');
  out.width = 1200;
  out.height = 630;
  const o = out.getContext('2d');
  o.imageSmoothingEnabled = false;
  o.drawImage(low, 0, 0, 1200, 630);
  // dark panel behind the text (top right, over the wall)
  o.fillStyle = 'rgba(20,18,28,0.82)';
  o.fillRect(640, 28, 532, 250);
  o.fillStyle = '#e8c547';
  o.fillRect(640, 28, 532, 6);
  const text = (s, x, y, size, colour) => {
    o.font = `700 ${size}px "Pixelify Sans", monospace`;
    o.fillStyle = '#14121c';
    o.fillText(s, x + size / 12, y + size / 12);
    o.fillStyle = colour;
    o.fillText(s, x, y);
  };
  o.textBaseline = 'alphabetic';
  text('Pixel Me In', 668, 110, 64, '#e8c547');
  text('SAVE YOUR RAM', 668, 178, 52, '#f4f1e8');
  text('Your face. Your RAM. Your device.', 668, 238, 26, '#9cf3ff');
  // bottom band with the address
  o.fillStyle = 'rgba(20,18,28,0.85)';
  o.fillRect(0, 568, 1200, 62);
  text('Free browser game  ·  play.madhavkwatra.in', 34, 610, 30, '#f4f1e8');
  return out.toDataURL('image/png');
});

writeFileSync('public/og-image.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log('wrote public/og-image.png');
await browser.close();
