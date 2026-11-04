// Dev tool: launch images for socials, drawn from the real game art and the
// maker's own face (the game's photo pipeline, all in the local browser).
//   node scripts/promo-images.mjs [photo] [baseUrl]   (needs `npm run dev`)
// Output: promo/images/*.png (git-ignored: it shows the owner's face) –
// an "everything" post, a 5-slide carousel, a story, an X/LinkedIn image and a before/after.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openBooth, writeDataUrl } from './promo-lib.mjs';

const photo = process.argv[2] ?? 'e2e/local-faces/myPhoto.jpg';
const base = process.argv[3] ?? 'http://localhost:5190';
const out = 'promo/images';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
await openBooth(page, base, photo);

const photoB64 = readFileSync(photo).toString('base64');
const images = await page.evaluate(drawAll, { photoB64, mime: 'image/jpeg' });
for (const [name, url] of Object.entries(images)) {
  writeDataUrl(join(out, `${name}.png`), url);
  console.log(`wrote ${out}/${name}.png`);
}
await browser.close();

/** Runs in the page: returns { name: dataUrl }. */
async function drawAll({ photoB64, mime }) {
  const { ZONES, LAYER_SIZE, GROUND_TILE, SPRITES, paint } = await import('/src/art/world.ts');
  const { drawRobotSheet, ROBOT_W, ROBOT_H, ROBOT_FRAMES } = await import('/src/art/robot.ts');
  const { loadAvatar } = await import('/src/face/faceStore.ts');
  const { loadFace, renderFrames, renderHead } = await import('/src/face/renderAvatar.ts');
  const { fileToCanvas } = await import('/src/face/source.ts');
  const { detectFaces } = await import('/src/face/detectFace.ts');
  const { pickMainFace } = await import('/src/face/geometry.ts');
  await document.fonts.load('700 40px "Pixelify Sans"');
  await document.fonts.ready;

  const C = {
    navy: '#1b1f3b',
    ink: '#14121c',
    yellow: '#e8c547',
    paper: '#f4f1e8',
    cyan: '#9cf3ff',
    red: '#ff5a5a',
  };
  const ADDRESS = 'play.madhavkwatra.in';
  const avatar = await loadAvatar();
  const face = await loadFace(avatar);
  const look = (over = {}) => ({
    ...avatar,
    style: { ...avatar.style, style: 'pixel', palette: 'natural', ...over.style },
    outfit: over.outfit ?? 'tee',
    hat: over.hat ?? null,
    faceAcc: over.faceAcc ?? null,
  });
  const ME = look();
  const char = (frame, scale, cfg = ME) => renderFrames(face, cfg, scale, [frame])[0];
  const robotSheet = drawRobotSheet();
  const sprite = (k) => paint(SPRITES[k].w, SPRITES[k].h, SPRITES[k].draw);
  const ram = sprite('ram');
  const rgb = sprite('ramRgb');
  const bomb = sprite('bomb');
  const mark = sprite('mark');

  // The photo, cropped around the face the game's own detector finds.
  const blob = await (await fetch(`data:${mime};base64,${photoB64}`)).blob();
  const src = await fileToCanvas(blob);
  const main = pickMainFace(await detectFaces(src));
  const fb = main?.box ?? {
    x: src.width * 0.3,
    y: src.height * 0.2,
    w: src.width * 0.4,
    h: src.height * 0.4,
  };
  const photoCrop = (aspect = 1, pad = 2.1) => {
    let h = Math.min(fb.h * pad * 1.12, src.height);
    let w = h * aspect;
    if (w > src.width) {
      w = src.width;
      h = w / aspect;
    }
    const cx = fb.x + fb.w / 2;
    const cy = fb.y + fb.h * 0.52;
    const x = Math.max(0, Math.min(src.width - w, cx - w / 2));
    const y = Math.max(0, Math.min(src.height - h, cy - h / 2));
    return { x, y, w, h };
  };

  // ---------------------------------------------------------------- helpers
  const canvas = (w, h, bg = C.navy) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    if (bg) {
      x.fillStyle = bg;
      x.fillRect(0, 0, w, h);
    }
    return [c, x];
  };
  const font = (size) => `700 ${size}px "Pixelify Sans", monospace`;
  /** Pixel-font text with a hard ink shadow. */
  const text = (o, s, x, y, size, colour, align = 'left', shadow = true) => {
    o.font = font(size);
    o.textAlign = align;
    o.textBaseline = 'alphabetic';
    if (shadow) {
      o.fillStyle = C.ink;
      const d = Math.max(3, Math.round(size / 12));
      o.fillText(s, x + d, y + d);
    }
    o.fillStyle = colour;
    o.fillText(s, x, y);
  };
  /** Text that fits a width: shrinks the size until it does. */
  const fitText = (o, s, x, y, size, colour, maxW, align = 'left') => {
    let n = size;
    o.font = font(n);
    while (o.measureText(s).width > maxW && n > 10) o.font = font(--n);
    text(o, s, x, y, n, colour, align);
    return n;
  };
  /** A box in the game's style: fill, ink border, hard shadow. */
  const box = (o, x, y, w, h, fill, border = 6, shadow = 10) => {
    o.fillStyle = C.ink;
    if (shadow) o.fillRect(x + shadow, y + shadow, w, h);
    o.fillRect(x, y, w, h);
    o.fillStyle = fill;
    o.fillRect(x + border, y + border, w - border * 2, h - border * 2);
  };
  /** A button-like label. Returns its width. */
  const chip = (o, s, x, y, size, fill = C.yellow, colour = C.ink, align = 'left') => {
    o.font = font(size);
    const w = o.measureText(s).width + size * 1.2;
    const h = size * 1.6;
    const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    box(o, left, y, w, h, fill, Math.max(3, size / 9), Math.max(4, size / 6));
    text(o, s, left + w / 2, y + h * 0.7, size, colour, 'center', false);
    return w;
  };
  /** Pixel arrow pointing right (or down), drawn from blocks. */
  const arrow = (o, x, y, s, colour = C.yellow, dir = 'right') => {
    const rows = ['1000', '1100', '1110', '1111', '1110', '1100', '1000'];
    o.fillStyle = C.ink;
    const draw = (dx, dy, col) => {
      o.fillStyle = col;
      for (let r = 0; r < rows.length; r++)
        for (let k = 0; k < 4; k++) {
          if (rows[r][k] !== '1') continue;
          const [px, py] = dir === 'right' ? [k + 3, r] : [r, k + 3];
          o.fillRect(x + px * s + dx, y + py * s + dy, s, s);
        }
      // the shaft
      if (dir === 'right') o.fillRect(x + dx, y + 2 * s + dy, 3 * s, 3 * s);
      else o.fillRect(x + 2 * s + dx, y + dy, 3 * s, 3 * s);
    };
    draw(s / 2, s / 2, C.ink);
    draw(0, 0, colour);
  };
  /** A pixel check mark in a small yellow square. */
  const check = (o, x, y, s) => {
    box(o, x, y, s * 9, s * 9, C.yellow, s, s);
    o.fillStyle = C.ink;
    const pts = [
      [2, 4],
      [3, 5],
      [4, 6],
      [5, 5],
      [6, 4],
      [7, 3],
      [7, 2],
    ];
    for (const [px, py] of pts) o.fillRect(x + px * s, y + py * s, s, s * 1.5);
  };
  /** The photo in a white frame (a little like a printed photo). */
  const framedPhoto = (o, x, y, w, h, aspect = w / h) => {
    box(o, x - 14, y - 14, w + 28, h + 28, C.paper, 6, 12);
    const r = photoCrop(aspect);
    o.imageSmoothingEnabled = true;
    o.drawImage(src, r.x, r.y, r.w, r.h, x, y, w, h);
    o.imageSmoothingEnabled = false;
  };
  const robot = (frame) => {
    const c = document.createElement('canvas');
    c.width = ROBOT_W;
    c.height = ROBOT_H;
    const i = ROBOT_FRAMES.indexOf(frame);
    c.getContext('2d').drawImage(
      robotSheet,
      i * ROBOT_W,
      0,
      ROBOT_W,
      ROBOT_H,
      0,
      0,
      ROBOT_W,
      ROBOT_H,
    );
    return c;
  };
  /**
   * A game scene at low resolution (w×h, ground line g), zone 0 or 1.
   * `parts` draw extra things on top (in low-res pixels).
   */
  const scene = (w, h, g, zone = 0, parts = () => {}) => {
    const z = ZONES[zone];
    const [low, c] = canvas(w, h, null);
    c.drawImage(paint(w, h, z.sky), 0, 0);
    const far = paint(LAYER_SIZE.w, LAYER_SIZE.h, z.far);
    const mid = paint(LAYER_SIZE.w, LAYER_SIZE.h, z.mid);
    const ground = paint(GROUND_TILE.w, GROUND_TILE.h, z.ground);
    for (let x = -120; x < w; x += LAYER_SIZE.w) c.drawImage(far, x, g - LAYER_SIZE.h - 20);
    for (let x = -60; x < w; x += LAYER_SIZE.w) c.drawImage(mid, x, g - LAYER_SIZE.h + 10);
    for (let y = g; y < h; y += GROUND_TILE.h)
      for (let x = 0; x < w; x += GROUND_TILE.w) c.drawImage(ground, x, y);
    // below the first ground row: darker dirt
    if (h > g + GROUND_TILE.h) {
      c.fillStyle = 'rgba(20,18,28,0.35)';
      c.fillRect(0, g + GROUND_TILE.h, w, h);
    }
    parts(c);
    return low;
  };
  const up = (o, low, x, y, s) => o.drawImage(low, x, y, low.width * s, low.height * s);
  /** Stand a sprite on the ground line (low-res coordinates). */
  const stand = (c, img, x, g, lift = 0) => c.drawImage(img, x, g - img.height + 2 - lift);
  const ramArc = (c, x0, g, n, step, height, rgbAt = -1, base = 60) => {
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0;
      c.drawImage(
        i === rgbAt ? rgb : ram,
        x0 + i * step,
        g - base - height * Math.sin(t * Math.PI),
      );
    }
  };
  /** The game's laser beam at its real height. */
  const beam = (c, w, g) => {
    c.fillStyle = 'rgba(255,90,90,0.25)';
    c.fillRect(0, g - 62, w, 24);
    c.fillStyle = C.red;
    c.fillRect(0, g - 56, w, 12);
    c.fillStyle = '#ffd0d0';
    c.fillRect(0, g - 52, w, 4);
  };
  const shadowBand = (o, y, h, w, a = 0.85) => {
    o.fillStyle = `rgba(20,18,28,${a})`;
    o.fillRect(0, y, w, h);
  };
  const result = {};
  const save = (name, c) => (result[name] = c.toDataURL('image/png'));

  // ---------------------------------------------------------------- 1) the everything post
  {
    const [c, o] = canvas(1080, 1350);
    // scene at the bottom
    const low = scene(540, 260, 200, 0, (s) => {
      stand(s, robot('walk2'), 16, 200);
      stand(s, char('run3', 1), 170, 200);
      ramArc(s, 250, 200, 7, 38, 50, 4);
    });
    up(o, low, 0, 830, 2);
    // title
    text(o, 'Pixel Me In', 540, 140, 120, C.yellow, 'center');
    text(o, 'SAVE YOUR RAM', 540, 232, 80, C.paper, 'center');
    text(o, 'Your face. Your RAM. Your device.', 540, 300, 42, C.cyan, 'center');
    // 3 steps
    const steps = [
      ['1', 'Take a selfie'],
      ['2', 'Get pixel art'],
      ['3', 'Run!'],
    ];
    const cw = 290;
    const ch = 300;
    const gap = 60;
    const x0 = (1080 - (cw * 3 + gap * 2)) / 2;
    const y0 = 350;
    steps.forEach(([n, label], i) => {
      const x = x0 + i * (cw + gap);
      box(o, x, y0, cw, ch, '#2a3160', 6, 10);
      const inner = { x: x + 25, y: y0 + 22, w: cw - 50, h: 200 };
      if (i === 0) framedPhoto(o, inner.x + 30, inner.y + 10, inner.w - 60, inner.h - 30);
      if (i === 1) {
        const head = renderHead(face, ME, 3);
        o.drawImage(head, x + (cw - head.width) / 2, inner.y + inner.h - head.height + 4);
      }
      if (i === 2) {
        const f = char('run3', 2);
        o.drawImage(f, x + (cw - f.width) / 2, inner.y + inner.h - f.height + 6);
      }
      text(o, `${n}. ${label}`, x + cw / 2, y0 + ch - 26, 36, C.paper, 'center');
      if (i < 2) arrow(o, x + cw + 10, y0 + ch / 2 - 28, 6);
    });
    // key points
    const points = [
      'Free',
      'Plays in your browser',
      'No install',
      'Your photo never leaves your device',
      'Open source',
    ];
    let px = 60;
    let py = 700;
    for (const p of points) {
      o.font = font(32);
      const w = o.measureText(p).width + 32 * 1.2;
      if (px + w > 1030) {
        px = 60;
        py += 70;
      }
      px += chip(o, p, px, py, 32, C.paper) + 22;
    }
    // villain label
    chip(o, 'The Utilizer wants your RAM', 34, 862, 28, C.red, C.paper);
    // address band
    shadowBand(o, 1250, 100, 1080, 0.9);
    text(o, `Play free  ·  ${ADDRESS}`, 540, 1318, 46, C.yellow, 'center');
    save('post-everything-1080x1350', c);
  }

  // ---------------------------------------------------------------- 2) carousel
  // Slide 1: the hook
  {
    const [c, o] = canvas(1080, 1350);
    const low = scene(540, 675, 560, 0, (s) => {
      ramArc(s, 330, 560, 4, 42, 30, -1, 140);
    });
    up(o, low, 0, 0, 2);
    shadowBand(o, 0, 360, 1080, 0.8);
    text(o, 'I put my face', 540, 150, 104, C.paper, 'center');
    text(o, 'in a video game', 540, 270, 104, C.yellow, 'center');
    const f = char('jump', 6);
    o.drawImage(f, 540 - f.width / 2 + 60, 1120 - f.height - 40);
    // the real photo, small, with an arrow to the character
    o.save();
    o.translate(150, 560);
    o.rotate(-0.08);
    framedPhoto(o, -110, -110, 220, 260);
    o.restore();
    arrow(o, 290, 600, 9);
    shadowBand(o, 1180, 170, 1080, 0.85);
    text(o, 'Pixel Me In: Save Your RAM', 60, 1282, 44, C.paper);
    const sw = chip(o, 'Swipe', 820, 1236, 40);
    arrow(o, 820 + sw + 18, 1240, 7);
    save('carousel-1-1080x1350', c);
  }
  // Slide 2: photo → pixel art
  {
    const [c, o] = canvas(1080, 1350);
    text(o, 'One selfie', 540, 130, 90, C.paper, 'center');
    text(o, '→ pixel art', 540, 230, 90, C.yellow, 'center');
    framedPhoto(o, 70, 330, 400, 480);
    arrow(o, 497, 530, 8);
    box(o, 600, 316, 428, 508, '#7ec8f2', 6, 12);
    const head = renderHead(face, ME, 6);
    o.drawImage(head, 814 - head.width / 2, 818 - head.height);
    text(o, 'Before', 270, 880, 44, C.paper, 'center');
    text(o, 'After', 814, 880, 44, C.yellow, 'center');
    const low = scene(540, 210, 120, 0, (s) => {
      stand(s, char('run2', 1), 225, 120);
      ramArc(s, 330, 120, 4, 40, 18, -1, 50);
    });
    up(o, low, 0, 930, 2);
    shadowBand(o, 1230, 120, 1080, 0.85);
    fitText(
      o,
      'Made on your phone. Your photo never leaves it.',
      540,
      1305,
      40,
      C.cyan,
      1000,
      'center',
    );
    save('carousel-2-1080x1350', c);
  }
  // Slide 3: Photo Booth looks
  {
    const [c, o] = canvas(1080, 1350);
    text(o, 'Make it yours', 540, 120, 90, C.yellow, 'center');
    fitText(o, 'Pick a look, a hat, glasses and an outfit', 540, 190, 40, C.paper, 980, 'center');
    const cards = [
      ['Pixel', look({ outfit: 'tee' })],
      ['Cartoon', look({ style: { style: 'cartoon' }, outfit: 'hoodie' })],
      ['Photo', look({ style: { style: 'original' }, outfit: 'tee' })],
      ['Retro green + cap', look({ style: { palette: 'retro' }, hat: 'cap', outfit: 'skater' })],
      ['Headphones', look({ hat: 'headphones', outfit: 'labcoat' })],
      ['Shades', look({ faceAcc: 'sunglasses', outfit: 'hoodie' })],
    ];
    const cw = 300;
    const chh = 470;
    const gx = 45;
    const x0 = (1080 - (cw * 3 + gx * 2)) / 2;
    cards.forEach(([label, cfg], i) => {
      const x = x0 + (i % 3) * (cw + gx);
      const y = 250 + Math.floor(i / 3) * (chh + 40);
      box(o, x, y, cw, chh, '#7ec8f2', 6, 10);
      o.fillStyle = '#5aa8d8';
      o.fillRect(x + 6, y + chh - 120, cw - 12, 114);
      const f = char('run1', 3, cfg);
      o.drawImage(f, x + (cw - f.width) / 2, y + chh - 110 - f.height);
      chip(
        o,
        label,
        x + cw / 2,
        y + chh - 88,
        label.length > 12 ? 22 : 28,
        C.yellow,
        C.ink,
        'center',
      );
    });
    shadowBand(o, 1250, 100, 1080, 0.9);
    text(o, 'The Photo Booth: free, no sign-up', 540, 1316, 40, C.paper, 'center');
    save('carousel-3-1080x1350', c);
  }
  // Slide 4: gameplay (3× pixels, so the action is big)
  {
    const [c, o] = canvas(1080, 1350);
    const G = 380;
    const low = scene(360, 450, G, 1, (s) => {
      beam(s, 360, G);
      stand(s, robot('laser'), -20, G);
      stand(s, char('slide', 1), 112, G);
      ramArc(s, 190, G, 4, 34, 36, 1, 84);
      // a cloud drop on its way to its red ring
      s.drawImage(mark, 300, G - mark.height + 3);
      s.drawImage(bomb, 302, G - 150);
    });
    up(o, low, 0, 0, 3);
    shadowBand(o, 0, 290, 1080, 0.82);
    text(o, 'Save your RAM', 540, 130, 100, C.yellow, 'center');
    text(o, 'from The Utilizer', 540, 230, 72, C.paper, 'center');
    chip(o, '32 GB', 60, 330, 44, C.ink, C.yellow);
    chip(o, '+8 GB RGB!', 520, 690, 36, C.yellow);
    chip(o, 'Slide under the beam', 60, 1200, 38, C.red, C.paper);
    chip(o, 'Jump the cloud drop', 1020, 1060, 34, C.paper, C.ink, 'right');
    save('carousel-4-1080x1350', c);
  }
  // Slide 5: privacy, open source, call to action
  {
    const [c, o] = canvas(1080, 1350);
    text(o, 'Free. Private.', 540, 130, 96, C.yellow, 'center');
    text(o, 'Open source.', 540, 240, 96, C.paper, 'center');
    const items = [
      'Plays in your browser, no install',
      'No account, no sign-up',
      'Your photo never leaves your device',
      'The pixel art is made on your phone',
      'Code on GitHub: pixel-me-in',
    ];
    items.forEach((s, i) => {
      check(o, 90, 320 + i * 92, 6);
      fitText(o, s, 170, 366 + i * 92, 40, C.paper, 850);
    });
    const low = scene(540, 250, 170, 0, (s) => {
      stand(s, robot('walk4'), 60, 170);
      stand(s, char('idle', 1), 300, 170);
      ramArc(s, 380, 170, 3, 34, 14, -1, 66);
    });
    up(o, low, 0, 800, 2);
    shadowBand(o, 1150, 200, 1080, 0.9);
    chip(o, `Play free: ${ADDRESS}`, 540, 1180, 48, C.yellow, C.ink, 'center');
    text(o, 'Link in bio', 540, 1318, 40, C.cyan, 'center');
    save('carousel-5-1080x1350', c);
  }

  // ---------------------------------------------------------------- 3) story (link sticker room)
  {
    const [c, o] = canvas(1080, 1920);
    const G = 540; // ground at y 1620
    const low = scene(360, 640, G, 0, (s) => {
      stand(s, robot('walk2'), 6, G);
      stand(s, char('run3', 1), 150, G);
      ramArc(s, 220, G, 4, 36, 30, 2, 70);
    });
    up(o, low, 0, 0, 3);
    shadowBand(o, 0, 760, 1080, 0.75);
    text(o, 'Pixel Me In', 540, 400, 130, C.yellow, 'center');
    text(o, 'SAVE YOUR RAM', 540, 510, 84, C.paper, 'center');
    text(o, 'Your face. Your RAM. Your device.', 540, 590, 44, C.cyan, 'center');
    fitText(
      o,
      'Free · in your browser · photo stays on your device',
      540,
      680,
      36,
      C.paper,
      960,
      'center',
    );
    // link sticker room (y ~930–1180, left empty on purpose) with a pointer
    text(o, 'Tap the link to play', 540, 840, 56, C.yellow, 'center');
    arrow(o, 515, 866, 7, C.yellow, 'down');
    text(o, ADDRESS, 540, 1712, 52, C.paper, 'center');
    save('story-1080x1920', c);
  }

  // ---------------------------------------------------------------- 4) X / LinkedIn 1200×675
  {
    const [c, o] = canvas(1200, 675);
    const G = 270;
    const low = scene(600, 338, G, 0, (s) => {
      stand(s, robot('walk2'), 18, G);
      stand(s, char('run3', 1), 150, G);
      ramArc(s, 236, G, 6, 30, 46, 3, 62);
    });
    up(o, low, 0, 0, 2);
    o.fillStyle = 'rgba(20,18,28,0.84)';
    o.fillRect(620, 34, 552, 300);
    o.fillStyle = C.yellow;
    o.fillRect(620, 34, 552, 6);
    text(o, 'Pixel Me In', 650, 118, 70, C.yellow);
    text(o, 'SAVE YOUR RAM', 650, 190, 54, C.paper);
    text(o, 'Your face. Your RAM.', 650, 252, 34, C.cyan);
    text(o, 'Your device.', 650, 300, 34, C.cyan);
    shadowBand(o, 600, 75, 1200, 0.88);
    fitText(
      o,
      `Free browser game · photo never leaves your device · ${ADDRESS}`,
      600,
      650,
      32,
      C.paper,
      1150,
      'center',
    );
    save('x-linkedin-1200x675', c);
  }

  // ---------------------------------------------------------------- 5) before / after
  {
    const [c, o] = canvas(1080, 1350);
    text(o, 'My selfie', 540, 130, 96, C.paper, 'center');
    text(o, '→ my game character', 540, 230, 76, C.yellow, 'center');
    framedPhoto(o, 70, 340, 400, 560);
    arrow(o, 497, 590, 8);
    box(o, 600, 326, 428, 588, '#7ec8f2', 6, 12);
    o.fillStyle = '#5aa8d8';
    o.fillRect(606, 820, 416, 88);
    const f = char('run3', 4);
    o.drawImage(f, 814 - f.width / 2, 830 - f.height);
    chip(o, 'Before', 270, 950, 40, C.paper, C.ink, 'center');
    chip(o, 'After', 814, 950, 40, C.yellow, C.ink, 'center');
    const low = scene(540, 160, 100, 0, (s) => ramArc(s, 60, 100, 12, 38, 12, 6, 40));
    up(o, low, 0, 1040, 2);
    shadowBand(o, 1230, 120, 1080, 0.9);
    fitText(o, `Made on my phone in seconds · ${ADDRESS}`, 540, 1305, 40, C.paper, 1000, 'center');
    save('before-after-1080x1350', c);
  }
  return result;
}
