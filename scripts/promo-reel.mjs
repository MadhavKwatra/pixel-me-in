// Dev tool: a fast Instagram Reel (1080×1920, ~18 s, loops) from the real game.
//   node scripts/promo-reel.mjs [photo] [baseUrl] [--reuse] [--guides]   (needs `npm run dev` + ffmpeg)
// Output: promo/videos/pixel-me-in-reel.mp4 (git-ignored: it shows the owner's face).
// Work files: promo/videos/reel-work/ (recordings, frames; `--reuse` skips the recording
// and only cuts again). Review: test-results/reel/ (contact sheet, safe-zone copy with --guides).
//
// How: three short browser sessions (Photo Booth montage, the zap + a run on autopilot,
// a clean music loop), each with a flash + shutter mark to line up picture and sound.
// Every game sound and event is logged with its time, so the cut finds the moments
// (RAM, 8 GB RGB stick, beam, cloud drop, stumble, "Utilized!") by itself. The edit
// is on a 132 BPM beat grid (the Your Desk song): 40 beats, so the music loops cleanly.
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  LOUD,
  collectAudio,
  openBooth,
  sceneCuts,
  soundStarts,
  tapAudio,
  wait,
  writeDataUrl,
} from './promo-lib.mjs';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const [photo = 'e2e/local-faces/myPhoto.jpg', base = 'http://localhost:5190'] = args.filter(
  (a) => !a.startsWith('--'),
);
const OUT = 'promo/videos';
const WORK = join(OUT, 'reel-work');
const CHECK = 'test-results/reel';
for (const d of [WORK, CHECK]) mkdirSync(d, { recursive: true });

const BPM = 132;
const BEAT = 60 / BPM;
const FPS = 30;
const BEATS = 40;
const W = 1080;
const H = 1920;
const VIEW = { width: 540, height: 960 };
// Recording settings: no music (the music bed is added in the edit), no touch pad.
const QUIET = { music: false, touchButtons: 'never' };
// Run: start a bit before the first Robot Rush (410 m); the autopilot lets go inside it.
const START_M = 260;
const AUTOPILOT_S = 32;
const frameAt = (beat) => Math.round(beat * BEAT * FPS);

const run = (cmd, list) => execFileSync(cmd, list, { stdio: ['ignore', 'ignore', 'inherit'] });
const ff = (list) => run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...list]);
const saveJson = (name, data) => writeFileSync(join(WORK, `${name}.json`), JSON.stringify(data));
const loadJson = (name) => JSON.parse(readFileSync(join(WORK, `${name}.json`), 'utf8'));
const nearest = (list, x, within) => {
  let best;
  for (const v of list)
    if (Math.abs(v - x) <= within && (best === undefined || Math.abs(v - x) < Math.abs(best - x)))
      best = v;
  return best;
};

// ---------------------------------------------------------------- recording

/** One browser session. `fn(page)` returns a log with `marker` (wall clock ms). */
async function session(name, fn, { video = true, settings } = {}) {
  const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({
    ...devices['Pixel 7'],
    viewport: VIEW,
    deviceScaleFactor: 1,
    ...(video ? { recordVideo: { dir: WORK, size: VIEW } } : {}),
  });
  await ctx.addInitScript(tapAudio, { settings });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  const videoStart = Date.now();
  page.on('pageerror', (e) => console.log(`[${name}] PAGE ERROR:`, e.message));
  const log = await fn(page);
  const audio = await collectAudio(page);
  const v = video ? page.video() : null;
  await ctx.close();
  await browser.close();
  if (v) {
    const file = join(WORK, `${name}.webm`);
    rmSync(file, { force: true });
    renameSync(await v.path(), file);
  }
  if (audio) writeFileSync(join(WORK, `${name}-audio.webm`), Buffer.from(audio.b64, 'base64'));
  else console.log(`[${name}] no sound was recorded`);
  return { ...log, videoStart, audioStart: audio?.start ?? null };
}

/** A full-screen white flash + the shutter sound: the sync mark. Returns its wall time. */
function marker(page) {
  return page.evaluate(async () => {
    const { sfx } = await import('/src/audio/sfx.ts');
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#fff';
    document.body.append(el);
    sfx.shutter();
    const t = Date.now();
    await new Promise((r) => setTimeout(r, 300));
    el.remove();
    return t;
  });
}

/** Logs every game sound and game event with its wall time (window.__events). */
function startLog(page) {
  return page.evaluate(async () => {
    const { sfx } = await import('/src/audio/sfx.ts');
    const log = (window.__events = []);
    const push = (type, data) => log.push({ type, data, t: Date.now() });
    for (const k of Object.keys(sfx)) {
      const f = sfx[k];
      if (typeof f === 'function')
        sfx[k] = (...a) => {
          push(`sfx:${k}`);
          return f.apply(sfx, a);
        };
    }
    // The HUD shows the game's events (a dynamic import of the controller can be a second
    // copy of the module after a hot update, so read the page instead).
    let gb = 0;
    let toast = null;
    let chase = null;
    setInterval(() => {
      const g = Number.parseInt(document.querySelector('[data-g]')?.textContent ?? '', 10);
      if (Number.isFinite(g)) {
        if (g - gb >= 8) push('rgb', g);
        gb = g;
      }
      const t = document.querySelector('#hud .toast-line')?.textContent ?? null;
      if (t && t !== toast) push('toast', t);
      toast = t;
      const c = document.querySelector('#hud .chase')?.textContent ?? null;
      if (c && c !== chase) push('chase', /idle ram/i.test(c) ? 'rush' : 'close');
      chase = c;
    }, 40);
  });
}

async function recordBooth() {
  return session(
    'booth',
    async (page) => {
      await openBooth(page, `${base}/?demo`, photo);
      await wait(1500);
      const mark = await marker(page);
      await wait(900);
      const shots = [];
      const pick = async (label) => {
        await page.getByRole('button', { name: label, exact: true }).first().click();
        shots.push({ label, t: Date.now() });
        await wait(800);
      };
      const tab = async (label) => {
        await page.getByRole('tab', { name: label, exact: true }).click();
        await wait(350);
      };
      await pick('Cartoon');
      await pick('Photo');
      await pick('Pixel');
      await pick('Retro green');
      await page.getByRole('button', { name: 'Natural', exact: true }).click();
      await wait(350);
      await tab('Hat');
      await pick('Cap');
      await pick('Headphones');
      await tab('Face');
      await pick('Sunglasses');
      await tab('Outfit');
      await pick('Space suit');
      return { marker: mark, shots };
    },
    { settings: QUIET },
  );
}

async function recordRun(take) {
  return session(
    `run${take}`,
    async (page) => {
      await openBooth(page, `${base}/?demo&start=${START_M}&autopilot=${AUTOPILOT_S}`, photo);
      // The reel has its own big captions for these, so the small hint boxes are hidden.
      await page.addStyleTag({ content: '#hud .hint { display: none !important; }' });
      await startLog(page);
      await wait(1500);
      const mark = await marker(page);
      await wait(900);
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      const played = Date.now();
      await page.getByRole('heading', { name: 'Utilized!' }).waitFor({ timeout: 90_000 });
      const utilized = Date.now();
      await wait(2200);
      const events = await page.evaluate(() => window.__events);
      return { marker: mark, played, utilized, events };
    },
    { settings: QUIET },
  );
}

/** Finds the moments of a run (wall times); missing ones are null. */
function moments(r) {
  const ev = r.events;
  const first = (type, after = 0, test = () => true) =>
    ev.find((e) => e.type === type && e.t > after && test(e))?.t ?? null;
  const go = first('sfx:go');
  const rush = first('chase', 0, (e) => e.data === 'rush');
  const stumble = first('sfx:stumble');
  const grabbed = ev.find((e) => e.type === 'toast' && /grabbed/.test(e.data));
  // the RGB stick before the Robot Rush (so the story stays in order)
  const rgb = first('rgb', 0, (e) => !rush || e.t < rush - 1500);
  const milestone = ev.find(
    (e) =>
      e.type === 'toast' &&
      / GB – /.test(e.data) &&
      (!rgb || Math.abs(e.t - rgb) > 1500) &&
      (!rush || e.t < rush - 1000),
  );
  // a beam fired while the autopilot still dodged (before the stumble)
  const laser = first('sfx:laser', rush ?? 0, (e) => !stumble || e.t < stumble - 300);
  const thrown = first('sfx:throwBomb', rush ?? 0, (e) => !stumble || e.t < stumble - 1500);
  const bombJump = thrown ? first('sfx:jump', thrown) : null;
  const caught = first('sfx:dissolve', stumble ?? 0);
  // the densest 1.1 s of RAM pickups before the rush (not next to the RGB stick)
  const gears = ev.filter((e) => e.type === 'sfx:gear').map((e) => e.t);
  let ramAt = null;
  let most = 0;
  for (const t of gears) {
    if (go && t < go + 800) continue;
    if (rush && t > rush - 1200) continue;
    if (rgb && Math.abs(t - rgb) < 1800) continue;
    const n = gears.filter((g) => g >= t && g < t + 1100).length;
    if (n > most) [most, ramAt] = [n, t];
  }
  return {
    zapAt: first('sfx:shutter', r.played - 500),
    go,
    ramAt,
    rgb,
    milestone: milestone ? { t: milestone.t, text: milestone.data } : null,
    rush,
    laser,
    bombJump: bombJump && bombJump - thrown < 2500 ? bombJump : null,
    stumble,
    grabbed: grabbed ? { t: grabbed.t, text: grabbed.data } : null,
    caught,
    utilized: r.utilized,
  };
}

const NEEDED = ['zapAt', 'ramAt', 'rgb', 'rush', 'laser', 'bombJump', 'stumble', 'caught'];
const missing = (m) => NEEDED.filter((k) => !m[k]);

// ---------------------------------------------------------------- frames (in the page)

/** Hook frames, end-card frames and caption PNGs, drawn in the page. */
async function renderFrames(page, captions) {
  await page.evaluate(
    async ({ photoB64, BEAT, FPS, W, H, frameAtList, captions }) => {
      const { ZONES, LAYER_SIZE, GROUND_TILE, SPRITES, paint } = await import('/src/art/world.ts');
      const { drawRobotSheet, ROBOT_W, ROBOT_H } = await import('/src/art/robot.ts');
      const { loadAvatar } = await import('/src/face/faceStore.ts');
      const { loadFace, renderFrames } = await import('/src/face/renderAvatar.ts');
      const { RUN_FRAMES } = await import('/src/art/body.ts');
      const { fileToCanvas } = await import('/src/face/source.ts');
      const { detectFaces } = await import('/src/face/detectFace.ts');
      const { pickMainFace } = await import('/src/face/geometry.ts');
      await document.fonts.load('700 40px "Pixelify Sans"');
      const C = {
        navy: '#1b1f3b',
        ink: '#14121c',
        yellow: '#e8c547',
        paper: '#f4f1e8',
        cyan: '#9cf3ff',
      };
      const font = (n) => `700 ${n}px "Pixelify Sans", monospace`;
      const avatar = await loadAvatar();
      const face = await loadFace(avatar);
      const ME = {
        ...avatar,
        style: { ...avatar.style, style: 'pixel', palette: 'natural' },
        outfit: 'tee',
        hat: null,
        faceAcc: null,
      };
      const runFrames = renderFrames(face, ME, 1, RUN_FRAMES);
      const robotSheet = drawRobotSheet();
      const spr = (k) => paint(SPRITES[k].w, SPRITES[k].h, SPRITES[k].draw);
      const ram = spr('ram');
      const rgb = spr('ramRgb');

      const canvas = (w = W, h = H) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const o = c.getContext('2d');
        o.imageSmoothingEnabled = false;
        return [c, o];
      };
      const text = (o, s, x, y, size, colour, scale = 1) => {
        o.save();
        o.translate(x, y);
        o.scale(scale, scale);
        o.font = font(size);
        o.textAlign = 'center';
        o.textBaseline = 'middle';
        o.lineJoin = 'round';
        o.lineWidth = Math.max(8, size / 6);
        o.strokeStyle = C.ink;
        o.fillStyle = C.ink;
        const d = Math.max(4, Math.round(size / 12));
        o.strokeText(s, d, d);
        o.fillText(s, d, d);
        o.strokeText(s, 0, 0);
        o.fillStyle = colour;
        o.fillText(s, 0, 0);
        o.restore();
      };
      const fit = (o, s, size, maxW) => {
        let n = size;
        o.font = font(n);
        while (o.measureText(s).width > maxW && n > 20) o.font = font(--n);
        return n;
      };
      const send = async (dir, name, c) => window.__saveFrame(dir, name, c.toDataURL('image/png'));

      // A scrolling desk scene at 3× (360×640 low-res, ground at 540).
      const z = ZONES[0];
      const sky = paint(360, 640, z.sky);
      const far = paint(LAYER_SIZE.w, LAYER_SIZE.h, z.far);
      const mid = paint(LAYER_SIZE.w, LAYER_SIZE.h, z.mid);
      const ground = paint(GROUND_TILE.w, GROUND_TILE.h, z.ground);
      const G = 540;
      const lowScene = (scroll) => {
        const [c, o] = canvas(360, 640);
        o.drawImage(sky, 0, 0);
        const tile = (img, speed, y, w) => {
          const off = -((scroll * speed) % w);
          for (let x = off - w; x < 360 + w; x += w) o.drawImage(img, Math.round(x), y);
        };
        tile(far, 0.12, G - LAYER_SIZE.h - 20, LAYER_SIZE.w);
        tile(mid, 0.4, G - LAYER_SIZE.h + 10, LAYER_SIZE.w);
        for (let y = G; y < 640; y += GROUND_TILE.h) tile(ground, 1, y, GROUND_TILE.w);
        return [c, o];
      };

      // ---- the photo (full size), cropped 9:16 around the face
      const blob = await (await fetch(`data:image/jpeg;base64,${photoB64}`)).blob();
      const small = await fileToCanvas(blob);
      const big = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      const k = big.width / small.width;
      const fb = pickMainFace(await detectFaces(small))?.box ?? {
        x: small.width * 0.3,
        y: small.height * 0.2,
        w: small.width * 0.4,
        h: small.height * 0.4,
      };
      let ch = Math.min(fb.h * k * 2.6, big.height);
      let cw = (ch * W) / H;
      if (cw > big.width) [cw, ch] = [big.width, (big.width * H) / W];
      const cx = (fb.x + fb.w / 2) * k;
      const cy = (fb.y + fb.h * 0.5) * k;
      const crop = {
        x: Math.max(0, Math.min(big.width - cw, cx - cw / 2)),
        y: Math.max(0, Math.min(big.height - ch, cy - ch * 0.45)),
        w: cw,
        h: ch,
      };
      const photoFrame = (zoom = 1, block = 0) => {
        const [c, o] = canvas();
        const w = crop.w / zoom;
        const h = crop.h / zoom;
        const sx = crop.x + (crop.w - w) / 2;
        const sy = crop.y + (crop.h - h) / 2;
        if (!block) {
          o.imageSmoothingEnabled = true;
          o.drawImage(big, sx, sy, w, h, 0, 0, W, H);
          return c;
        }
        const [s, so] = canvas(Math.ceil(W / block), Math.ceil(H / block));
        so.imageSmoothingEnabled = true;
        so.drawImage(big, sx, sy, w, h, 0, 0, s.width, s.height);
        o.drawImage(s, 0, 0, s.width * block, s.height * block);
        return c;
      };

      // ---- hook: photo → flash → mosaic → chunky pixels → you, running in the game
      const hookN = frameAtList.hookEnd;
      const beat1 = Math.round(BEAT * FPS);
      for (let f = 0; f < hookN; f++) {
        let c;
        if (f < beat1) c = photoFrame(1 + 0.05 * (f / beat1));
        else if (f < beat1 + 2) {
          [c] = canvas();
          const o = c.getContext('2d');
          o.drawImage(photoFrame(1.05, 54), 0, 0);
          o.fillStyle = `rgba(255,255,255,${f === beat1 ? 1 : 0.6})`;
          o.fillRect(0, 0, W, H);
        } else if (f < beat1 + 5) c = photoFrame(1.05, 54);
        else if (f < beat1 + 8) c = photoFrame(1.05, 27);
        else {
          const t = f - (beat1 + 8);
          const [low, lo] = lowScene(t * 6);
          const fr = runFrames[Math.floor(t / 2) % runFrames.length];
          // the character big in the middle of the scene (3 low-res px per game px)
          lo.drawImage(
            fr,
            0,
            0,
            fr.width,
            fr.height,
            Math.round(180 - fr.width * 1.5),
            G - fr.height * 3 + 6,
            fr.width * 3,
            fr.height * 3,
          );
          [c] = canvas();
          const o = c.getContext('2d');
          o.imageSmoothingEnabled = false;
          o.drawImage(low, 0, 0, W, H);
          if (t < 2) {
            o.fillStyle = `rgba(255,255,255,${0.7 - t * 0.35})`;
            o.fillRect(0, 0, W, H);
          }
        }
        await send('hook', f, c);
      }

      // ---- end card: scrolling desk, you running, The Utilizer chasing, the address
      const endN = frameAtList.endLen;
      const appear = (f, beat) => f >= Math.round(beat * BEAT * FPS);
      const pop = (f, beat) => {
        const d = f - Math.round(beat * BEAT * FPS);
        return d < 0 ? 0 : d < 3 ? 1.18 - d * 0.06 : 1;
      };
      for (let f = 0; f < endN; f++) {
        const [low, lo] = lowScene(f * 7);
        const fr = runFrames[Math.floor(f / 2) % runFrames.length];
        const rf = Math.floor(f / 3) % 8;
        lo.drawImage(
          robotSheet,
          rf * ROBOT_W,
          0,
          ROBOT_W,
          ROBOT_H,
          8,
          G - ROBOT_H + 2,
          ROBOT_W,
          ROBOT_H,
        );
        lo.drawImage(fr, 150, G - fr.height + 2);
        for (let i = 0; i < 4; i++) {
          const x = ((260 + i * 46 - f * 7) % 230) + 200;
          const bob = Math.round(Math.sin((f + i * 9) / 5) * 3);
          lo.drawImage(i === 2 ? rgb : ram, x, G - 64 - i * 6 + bob);
        }
        const [c, o] = canvas();
        o.drawImage(low, 0, 0, W, H);
        o.fillStyle = 'rgba(20,18,28,0.72)';
        o.fillRect(0, 0, W, 1060);
        text(o, 'Pixel Me In', 540, 400, 130, C.yellow, pop(f, 0) || 1);
        text(o, 'SAVE YOUR RAM', 540, 520, 84, C.paper);
        if (appear(f, 1)) text(o, 'Play free', 540, 680, 72, C.cyan, pop(f, 1));
        if (appear(f, 2)) {
          const n = fit(o, 'play.madhavkwatra.in', 84, 940);
          text(o, 'play.madhavkwatra.in', 540, 810, n, C.yellow, pop(f, 2));
        }
        if (appear(f, 3)) text(o, 'link in bio', 540, 940, 60, C.paper, pop(f, 3));
        // the last frames fade to white, so the loop starts with the selfie flash
        const left = endN - f;
        if (left <= 5) {
          o.fillStyle = `rgba(255,255,255,${(6 - left) / 5})`;
          o.fillRect(0, 0, W, H);
        }
        await send('end', f, c);
      }

      // ---- captions: transparent full-frame PNGs
      for (const [i, cap] of captions.entries()) {
        const [c, o] = canvas();
        const sizes = cap.lines.map((line) => fit(o, line, cap.size ?? 96, 920));
        if (cap.band) {
          const h = sizes.reduce((a, n) => a + n * 1.12, 0) + 40;
          o.fillStyle = 'rgba(20,18,28,0.82)';
          o.fillRect(0, cap.y - sizes[0] * 0.6 - 20, W, h);
        }
        let y = cap.y;
        cap.lines.forEach((line, j) => {
          const colour = cap.colours?.[j] ?? (j === 0 ? C.paper : C.yellow);
          text(o, line, 540, y, sizes[j], colour);
          y += sizes[j] * 1.12;
        });
        await send('captions', i, c);
      }
    },
    {
      photoB64: readFileSync(photo).toString('base64'),
      BEAT,
      FPS,
      W,
      H,
      frameAtList: FRAMES,
      captions,
    },
  );
}

async function recordMusicAndFrames(captions) {
  for (const d of ['hook', 'end', 'captions']) {
    rmSync(join(WORK, d), { recursive: true, force: true });
    mkdirSync(join(WORK, d));
  }
  return session(
    'music',
    async (page) => {
      await page.exposeFunction('__saveFrame', (dir, name, url) =>
        writeDataUrl(join(WORK, dir, `${String(name).padStart(4, '0')}.png`), url),
      );
      await openBooth(page, `${base}/?demo`, photo);
      await renderFrames(page, captions);
      // A clean music bed: the Your Desk song, with the shutter on beat 1 (the hook's
      // flash) and the power-up jingle when the end card shows.
      const start = await page.evaluate(
        async ({ BEAT, endBeat }) => {
          const music = await import('/src/audio/music.ts');
          const { sfx } = await import('/src/audio/sfx.ts');
          music.stopMusic();
          await new Promise((r) => setTimeout(r, 1500));
          music.playZoneMusic(0);
          const t = Date.now();
          setTimeout(() => sfx.shutter(), BEAT * 1000);
          setTimeout(() => sfx.power(), endBeat * BEAT * 1000);
          return t;
        },
        { BEAT, endBeat: PLAN.endBeat },
      );
      await wait((BEATS * BEAT + 2) * 1000);
      return { marker: start };
    },
    { video: false },
  );
}

// ---------------------------------------------------------------- sync

/** The flash makes two picture changes ~0.3 s apart (on, off): take the first of such a pair. */
function flashAt(cuts, expected) {
  const pairs = cuts.filter(
    (c) => Math.abs(c - expected) < 1.5 && cuts.some((d) => d - c > 0.2 && d - c < 0.5),
  );
  return nearest(pairs, expected, 1.5) ?? nearest(cuts, expected, 1.5);
}

/** Picture + sound of a session as one constant-30-fps file; returns the video time of the mark. */
function align(name, s, sourceName = name) {
  const webm = join(WORK, `${sourceName}.webm`);
  const aud = join(WORK, `${sourceName}-audio.webm`);
  const expV = (s.marker - s.videoStart) / 1000;
  const v0 = flashAt(sceneCuts(webm, 0.25), expV) ?? expV;
  const out = join(WORK, `${name}.mkv`);
  const inputs = ['-i', webm];
  let filter = `[0:v]fps=${FPS},format=yuv420p[v]`;
  if (s.audioStart && existsSync(aud)) {
    const expA = (s.marker - s.audioStart) / 1000;
    const a0 = nearest([0, ...soundStarts(aud, 0.3)], expA, 0.8) ?? expA;
    const shift = a0 - v0;
    console.log(
      `[${name}] mark: video ${v0.toFixed(2)} s (clock ${expV.toFixed(2)}), sound ${a0.toFixed(2)} s (clock ${expA.toFixed(2)})`,
    );
    inputs.push('-i', aud);
    filter +=
      shift >= 0
        ? `;[1:a]atrim=start=${shift.toFixed(3)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,apad[a]`
        : `;[1:a]adelay=${Math.round(-shift * 1000)}:all=1,aresample=48000,aformat=channel_layouts=stereo,apad[a]`;
  } else {
    inputs.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
    filter += ';[1:a]anull[a]';
  }
  ff([
    ...inputs,
    '-filter_complex',
    filter,
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-shortest',
    '-c:v',
    'libx264',
    '-crf',
    '12',
    '-preset',
    'veryfast',
    '-c:a',
    'pcm_s16le',
    out,
  ]);
  return { file: out, v0, marker: s.marker };
}

/** The music bed, from the first note, exactly as long as the reel. */
function musicBed(s) {
  const aud = join(WORK, 'music-audio.webm');
  const expA = (s.marker - s.audioStart) / 1000;
  const a0 = nearest(soundStarts(aud, 0.5), expA, 0.8) ?? expA;
  console.log(`[music] song starts at ${a0.toFixed(2)} s (clock ${expA.toFixed(2)})`);
  const out = join(WORK, 'music.wav');
  ff([
    '-i',
    aud,
    '-af',
    `atrim=start=${a0.toFixed(3)}:duration=${(TOTAL / FPS).toFixed(3)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo`,
    out,
  ]);
  return out;
}

// ---------------------------------------------------------------- the edit

// Beat plan (40 beats). Recorded shots get their source times after the recording.
const PLAN = {
  hookEnd: 3,
  boothBeats: 8,
  endBeat: 32,
};
const FRAMES = {
  hookEnd: frameAt(PLAN.hookEnd),
  endLen: frameAt(BEATS) - frameAt(PLAN.endBeat),
};
const TOTAL = frameAt(BEATS);

/** Crop for a punch-in on the recorded 540×960 picture (z = zoom, around cx, cy). */
function cropFor(z, cx = 270, cy = 480) {
  const w = Math.round(VIEW.width / z / 2) * 2;
  const h = Math.round(VIEW.height / z / 2) * 2;
  const x = Math.max(0, Math.min(VIEW.width - w, Math.round(cx - w / 2)));
  const y = Math.max(0, Math.min(VIEW.height - h, Math.round(cy - h / 2)));
  return `crop=${w}:${h}:${x}:${y}`;
}

/** One recorded piece: `from` s in the aligned file, `beats` long on the grid, at `speed`. */
function cutPiece(i, src, from, frames, { speed = 1, zoom = 1, cx, cy } = {}) {
  const out = join(WORK, 'pieces', `${String(i).padStart(2, '0')}.mkv`);
  const srcDur = (frames / FPS) * speed + 0.5;
  const tempo = [];
  for (let s = speed; Math.abs(s - 1) > 1e-6;) {
    const step = Math.min(2, Math.max(0.5, s));
    tempo.push(`atempo=${step.toFixed(4)}`);
    s /= step;
  }
  const v = [
    `setpts=(PTS-STARTPTS)/${speed}`,
    `fps=${FPS}`,
    ...(zoom > 1 ? [cropFor(zoom, cx, cy)] : []),
    `scale=${W}:${H}:flags=neighbor`,
    'setsar=1',
    'tpad=stop_mode=clone:stop_duration=2',
    `trim=end_frame=${frames}`,
    'setpts=PTS-STARTPTS',
  ].join(',');
  const a = [
    'asetpts=PTS-STARTPTS',
    ...tempo,
    'apad',
    `atrim=end_sample=${Math.round((frames / FPS) * 48000)}`,
  ].join(',');
  ff([
    '-ss',
    Math.max(0, from).toFixed(3),
    '-t',
    srcDur.toFixed(3),
    '-i',
    src,
    '-filter_complex',
    `[0:v]${v}[v];[0:a]${a}[a]`,
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-c:v',
    'libx264',
    '-crf',
    '12',
    '-preset',
    'veryfast',
    '-c:a',
    'pcm_s16le',
    out,
  ]);
  return out;
}

/** A piece from drawn frames (silent; the music bed plays under it). */
function framesPiece(i, dir, frames) {
  const out = join(WORK, 'pieces', `${String(i).padStart(2, '0')}.mkv`);
  ff([
    '-framerate',
    String(FPS),
    '-i',
    join(WORK, dir, '%04d.png'),
    '-f',
    'lavfi',
    '-i',
    'anullsrc=r=48000:cl=stereo',
    '-frames:v',
    String(frames),
    '-t',
    (frames / FPS).toFixed(4),
    '-vf',
    'format=yuv420p,setsar=1',
    '-c:v',
    'libx264',
    '-crf',
    '12',
    '-preset',
    'veryfast',
    '-c:a',
    'pcm_s16le',
    out,
  ]);
  return out;
}

// The player stands at about (150, 540) in the 540×960 run picture (ground at 612).
const PLAYER = { cx: 210, cy: 520 };
// Wider to the left, so The Utilizer behind the player stays in the picture.
const ROBOT = { cx: 170, cy: 520 };

function buildShots(booth, runA, m) {
  const bt = (t) => booth.v0 + (t - booth.marker) / 1000;
  const rt = (t) => runA.v0 + (t - runA.marker) / 1000;
  const shots = [];
  const add = (beats, make) => shots.push({ beats, make });
  // hook (drawn)
  add(PLAN.hookEnd, (i, f) => framesPiece(i, 'hook', f));
  // booth montage: 1 beat per look, every other one punched in on the preview
  booth.shots.forEach((s, j) =>
    add(1, (i, f) =>
      cutPiece(i, booth.file, bt(s.t) + 0.12, f, j % 2 ? { zoom: 1.3, cx: 270, cy: 330 } : {}),
    ),
  );
  // the zap, a bit faster
  add(2, (i, f) =>
    cutPiece(i, runA.file, rt(m.zapAt) - 0.05, f, { speed: 1.35, zoom: 2, cx: 270, cy: 470 }),
  );
  // RAM pickups (no milestone → this shot gets its 2 beats)
  const ramBeats = m.milestone ? 2 : 4;
  add(ramBeats, (i, f) =>
    cutPiece(i, runA.file, rt(m.ramAt) - 0.25, f, { speed: 1.15, zoom: 1.45, ...PLAYER }),
  );
  // the RGB stick: in at normal speed, then slow motion, punched in
  add(1, (i, f) => cutPiece(i, runA.file, rt(m.rgb) - 0.5, f, { zoom: 1.5, ...PLAYER }));
  add(2, (i, f) =>
    cutPiece(i, runA.file, rt(m.rgb) - 0.5 + BEAT, f, { speed: 0.5, zoom: 1.9, ...PLAYER }),
  );
  if (m.milestone) add(2, (i, f) => cutPiece(i, runA.file, rt(m.milestone.t) + 0.05, f));
  // The Utilizer arrives
  add(2, (i, f) => cutPiece(i, runA.file, rt(m.rush) - 0.1, f, { zoom: 1.3, cx: 200, cy: 470 }));
  // the beam: ramp into slow motion as it fires
  add(1, (i, f) => cutPiece(i, runA.file, rt(m.laser) - 0.6, f, { zoom: 1.4, ...ROBOT }));
  add(2, (i, f) =>
    cutPiece(i, runA.file, rt(m.laser) - 0.6 + BEAT, f, { speed: 0.5, zoom: 1.75, ...ROBOT }),
  );
  // the cloud drop jump
  add(2, (i, f) => cutPiece(i, runA.file, rt(m.bombJump) - 0.4, f, { zoom: 1.5, ...PLAYER }));
  // stumble: "He grabbed X GB!"
  add(2, (i, f) => cutPiece(i, runA.file, rt(m.stumble) - 0.2, f, { zoom: 1.6, ...ROBOT }));
  // caught: the pixel crash, then "Utilized!"
  add(1, (i, f) => cutPiece(i, runA.file, rt(m.caught) - 0.25, f, { zoom: 1.5, ...ROBOT }));
  add(2, (i, f) =>
    cutPiece(i, runA.file, rt(m.utilized) - 0.05, f, { zoom: 1.35, cx: 270, cy: 400 }),
  );
  // end card (drawn)
  add(BEATS - PLAN.endBeat, (i, f) => framesPiece(i, 'end', f));
  const sum = shots.reduce((n, s) => n + s.beats, 0);
  if (sum !== BEATS) throw new Error(`the shots add up to ${sum} beats, not ${BEATS}`);
  return shots;
}

/** Captions on the beat grid: [fromBeat, toBeat, lines, y]. */
function captionPlan(m) {
  const at = (b) => b; // beats
  let b = PLAN.hookEnd + PLAN.boothBeats + 2; // after the zap
  const list = [
    { from: at(0), to: at(3), lines: ['I turned my selfie', 'into a game'], y: 420 },
    { from: at(3), to: at(11), lines: ['Pick your look'], y: 1180, size: 88, band: true },
  ];
  const ramBeats = m.milestone ? 2 : 4;
  list.push({ from: b, to: b + ramBeats, lines: ['Save your RAM'], y: 440 });
  b += ramBeats;
  list.push({ from: b, to: b + 3, lines: ['8 GB', 'RGB stick!'], y: 420 });
  b += 3;
  if (m.milestone) {
    const [gb, joke] = m.milestone.text.split(' – ');
    list.push({ from: b, to: b + 2, lines: [gb, joke], y: 640, size: 80 });
    b += 2;
  }
  list.push({ from: b, to: b + 2, lines: ['The Utilizer', 'wants it!'], y: 700, size: 88 });
  b += 2;
  list.push({ from: b, to: b + 3, lines: ['Slide!'], y: 440, size: 120 });
  b += 3;
  list.push({ from: b, to: b + 2, lines: ['Jump!'], y: 440, size: 120 });
  b += 2;
  const lost = m.grabbed?.text.match(/(\d+) GB/)?.[1];
  list.push({
    from: b,
    to: b + 2,
    lines: lost ? ['He grabbed', `${lost} GB!`] : ['Ouch!'],
    y: 420,
  });
  b += 3; // the grab, then the pixel crash
  list.push({ from: b, to: b + 2, lines: ['UTILIZED!'], y: 330, size: 130, colours: ['#ff5a5a'] });
  return list;
}

// ---------------------------------------------------------------- main

let boothLog;
let runLog;
let runTake;
let musicLog;
if (flags.has('--reuse')) {
  ({ boothLog, runLog, runTake, musicLog } = loadJson('logs'));
} else {
  console.log('recording the Photo Booth montage…');
  boothLog = await recordBooth();
  let best = null;
  for (let take = 1; take <= 3; take++) {
    console.log(`recording run take ${take}…`);
    const r = await recordRun(take);
    const miss = missing(moments(r));
    console.log(
      miss.length ? `  take ${take} misses: ${miss.join(', ')}` : `  take ${take} has every moment`,
    );
    if (!best || miss.length < best.miss.length) best = { r, take, miss };
    if (!miss.length) break;
  }
  runLog = best.r;
  runTake = best.take;
  if (best.miss.length)
    console.log(`WARNING: the best run take still misses: ${best.miss.join(', ')}`);
  console.log('drawing frames + recording the music bed…');
  musicLog = await recordMusicAndFrames(captionPlan(moments(runLog)));
  saveJson('logs', { boothLog, runLog, runTake, musicLog });
}

const m = moments(runLog);
if (missing(m).length) throw new Error(`the run misses: ${missing(m).join(', ')} – record again`);
console.log(
  'moments (s after GO):',
  Object.fromEntries(
    Object.entries(m).map(([k, v]) => [
      k,
      typeof v === 'number' ? ((v - m.go) / 1000).toFixed(2) : (v?.text ?? v),
    ]),
  ),
);

const booth = { ...align('booth', boothLog), shots: boothLog.shots };
const runA = align('run', runLog, `run${runTake}`);
const bed = musicBed(musicLog);

rmSync(join(WORK, 'pieces'), { recursive: true, force: true });
mkdirSync(join(WORK, 'pieces'));
const shots = buildShots(booth, runA, m);
const pieces = [];
let beat = 0;
for (const [i, s] of shots.entries()) {
  const frames = frameAt(beat + s.beats) - frameAt(beat);
  pieces.push(s.make(i, frames));
  beat += s.beats;
}

// Join the pieces, lay the captions over them, mix the music bed under the game sounds.
const caps = captionPlan(m);
const inputs = pieces.flatMap((p) => ['-i', p]);
caps.forEach((_, i) =>
  inputs.push('-i', join(WORK, 'captions', `${String(i).padStart(4, '0')}.png`)),
);
inputs.push('-i', bed);
const n = pieces.length;
let filter = `${pieces.map((_, i) => `[${i}:v][${i}:a]`).join('')}concat=n=${n}:v=1:a=1[v0][sfx]`;
caps.forEach((c, i) => {
  const a = (frameAt(c.from) / FPS).toFixed(3);
  const b = (frameAt(c.to) / FPS - 0.001).toFixed(3);
  filter += `;[v${i}][${n + i}:v]overlay=0:0:enable='between(t,${a},${b})'[v${i + 1}]`;
});
const musicIn = n + caps.length;
filter += `;[v${caps.length}]format=yuv420p[vout]`;
filter += `;[${musicIn}:a]volume=1.0[mb];[sfx][mb]amix=inputs=2:normalize=0:duration=first,${LOUD}[aout]`;
const reel = join(OUT, 'pixel-me-in-reel.mp4');
ff([
  ...inputs,
  '-filter_complex',
  filter,
  '-map',
  '[vout]',
  '-map',
  '[aout]',
  '-t',
  (TOTAL / FPS).toFixed(3),
  '-r',
  String(FPS),
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '17',
  '-profile:v',
  'high',
  '-pix_fmt',
  'yuv420p',
  '-c:a',
  'aac',
  '-b:a',
  '192k',
  '-movflags',
  '+faststart',
  reel,
]);
console.log(`wrote ${reel} (${(TOTAL / FPS).toFixed(2)} s, ${BEATS} beats at ${BPM} BPM)`);

// Review: a contact sheet (one frame every 0.5 s) and, with --guides, a safe-zone copy.
ff([
  '-i',
  reel,
  '-vf',
  'fps=2,scale=216:384,tile=9x4',
  '-frames:v',
  '1',
  join(CHECK, 'reel-sheet.png'),
]);
if (flags.has('--guides')) {
  const guides = [
    'drawbox=x=0:y=0:w=1080:h=270:color=red@0.25:t=fill',
    'drawbox=x=0:y=1250:w=1080:h=670:color=red@0.25:t=fill',
    'drawbox=x=940:y=270:w=140:h=980:color=orange@0.25:t=fill',
    'drawbox=x=80:y=270:w=860:h=980:color=lime@0.9:t=4',
  ].join(',');
  ff([
    '-i',
    reel,
    '-vf',
    guides,
    '-c:v',
    'libx264',
    '-crf',
    '23',
    '-c:a',
    'copy',
    join(CHECK, 'reel-guides.mp4'),
  ]);
  console.log(`wrote ${CHECK}/reel-guides.mp4 and ${CHECK}/reel-sheet.png`);
}
for (const f of readdirSync(WORK)) if (/^[0-9a-f]{32}\.webm$/.test(f)) rmSync(join(WORK, f));
