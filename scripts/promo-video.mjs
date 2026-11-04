// Dev tool: record short demo videos of the real game, with its own sounds.
//   node scripts/promo-video.mjs [photo] [baseUrl] [landscape|vertical]   (needs the dev server + ffmpeg)
// Output: promo/videos/pixel-me-in-landscape.mp4 (1280×720) and -vertical.mp4 (1080×1920).
// Starts in the Photo Booth, plays a run (autopilot), ends with "Would you play this?".
// Captions go in a band above the game (never on top of it).
// Uses the owner's own photo (consent) – never commit the videos.
import { chromium, devices } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const photo = process.argv[2] ?? 'e2e/local-faces/myPhoto.jpg';
const base = process.argv[3] ?? 'http://localhost:5190';
const out = 'promo/videos';
const FONT = 'public/fonts/PixelifySans.ttf';
const BAND = 80;
// The game is quiet on purpose; videos get normal loudness (like other social clips).
// The limit is low because AAC overshoots on sharp chiptune waves.
const LOUD = 'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.55:level=disabled';
mkdirSync(out, { recursive: true });

// The page is recorded smaller than the final video: the caption band is added on top.
const FORMATS = {
  landscape: {
    opts: {
      viewport: { width: 1280, height: 720 - BAND },
      recordVideo: { dir: out, size: { width: 1280, height: 720 - BAND } },
    },
    fontSize: 36,
    scale: 1,
    // The Photo Booth is made for laptop screens; zoom in so it fills the video.
    boothZoom: 1.35,
  },
  // A phone layout at 540 wide, scaled ×2 with crisp pixels (Playwright does not upscale).
  vertical: {
    opts: {
      ...devices['Pixel 7'],
      viewport: { width: 540, height: 960 - BAND },
      deviceScaleFactor: 1,
      recordVideo: { dir: out, size: { width: 540, height: 960 - BAND } },
    },
    fontSize: 24,
    scale: 2,
    boothZoom: 1,
  },
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs in the page before anything else: every Web Audio context also feeds a
 * MediaRecorder, so the game's own sounds and music end up in the video.
 */
function tapAudio() {
  const promo = { chunks: [], start: 0, rec: null };
  window.__promo = promo;
  const Orig = window.AudioContext;
  window.AudioContext = class extends Orig {
    constructor(...args) {
      super(...args);
      this.__tap = this.createMediaStreamDestination();
      const begin = () => {
        if (promo.rec || this.state !== 'running') return;
        promo.rec = new MediaRecorder(this.__tap.stream, { mimeType: 'audio/webm;codecs=opus' });
        promo.rec.ondataavailable = (e) => e.data.size && promo.chunks.push(e.data);
        promo.rec.start(250);
        promo.start = Date.now();
      };
      this.addEventListener('statechange', begin);
      begin();
    }
  };
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (target, ...rest) {
    const result = connect.call(this, target, ...rest);
    if (target instanceof AudioDestinationNode && this.context.__tap)
      connect.call(this, this.context.__tap);
    return result;
  };
  // Unlock a few outfits so the booth shows them (scores stay at 0).
  localStorage.setItem(
    'pmi:stats',
    JSON.stringify({ best: 0, totalGears: 200, totalDistance: 6000, runs: 12 }),
  );
}

async function record(name, { opts, fontSize, scale, boothZoom }) {
  // Real GPU: smoother video (the game also guards against software WebGL glitches).
  const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(tapAudio);
  const page = await ctx.newPage();
  const videoStart = Date.now();
  page.on('pageerror', (e) => console.log(`[${name}] PAGE ERROR:`, e.message));

  // Captions: [seconds from the Photo Booth, text]; each one stays until the next.
  let boothAt = 0;
  const captions = [];
  const caption = (text) => captions.push([(Date.now() - boothAt) / 1000, text]);
  const click = (role, label, exact = true) =>
    page.getByRole(role, { name: label, exact }).first().click();

  // Get to the Photo Booth (this part is cut from the video).
  await page.goto(`${base}/?demo&start=372&autopilot=15`);
  await page
    .getByRole('button', { name: /play now/i })
    .first()
    .click();
  await page.locator('input[type=file]').setInputFiles(photo);
  await page.getByRole('heading', { name: 'Line it up' }).waitFor({ timeout: 60_000 });
  await click('button', 'Use this');
  await page.getByRole('heading', { name: 'Photo Booth' }).waitFor();
  const zoom = (z) => page.evaluate((z) => (document.documentElement.style.zoom = String(z)), z);
  await zoom(boothZoom);
  await wait(300);
  boothAt = Date.now();

  caption('They want your RAM. Not today.');
  await wait(2600);
  caption('Your selfie, made into pixel art');
  for (const look of ['Cartoon', 'Photo', 'Pixel']) {
    await click('button', look);
    await wait(900);
  }
  for (const colours of ['Game colours', 'Retro green', 'Natural']) {
    await click('button', colours);
    await wait(700);
  }
  caption('Hats, glasses, outfits…');
  await click('tab', 'Hat');
  for (const hat of ['Headphones', 'Cap']) {
    await click('button', hat);
    await wait(800);
  }
  await click('tab', 'Face');
  await click('button', 'Sunglasses');
  await wait(900);
  await click('tab', 'Outfit');
  for (const outfit of ['Space suit', 'Hoodie']) {
    await click('button', outfit);
    await wait(900);
  }

  caption('…then get zapped into the game!');
  await zoom(1);
  await click('button', 'Play');
  await page.locator('#hud').waitFor({ state: 'visible', timeout: 20_000 });
  caption('Grab every stick of RAM');
  await page
    .locator('.chase')
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  caption('…before The Utilizer does!');
  await page.getByRole('heading', { name: 'Utilized!' }).waitFor({ timeout: 60_000 });
  caption('Your photo never leaves your phone');
  await wait(2600);

  // End card + a sound at the same moment (also used to check the audio sync).
  caption('Pixel Me In: Save Your RAM');
  await page.evaluate(async (big) => {
    const { sfx } = await import('/src/audio/sfx.ts');
    const { playBoothMusic } = await import('/src/audio/music.ts');
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:${big ? 22 : 16}px;padding:24px;background:#1b1f3b;color:#f4f1e8;
      font-family:"Pixelify Sans",monospace;text-align:center`;
    el.innerHTML = `<div style="font-size:${big ? 76 : 50}px;line-height:1.1;color:#e8c547;text-shadow:5px 5px 0 #14121c">Would you play this?</div>
      <div style="font-size:${big ? 32 : 24}px">Your face. Your RAM. Your device.</div>
      <div style="font-size:${big ? 26 : 19}px;opacity:.85">Free · in your browser · photo stays on your device</div>
      <div style="margin-top:${big ? 18 : 12}px;font-size:${big ? 32 : 24}px;color:#14121c;background:#e8c547;
        border:4px solid #14121c;box-shadow:6px 6px 0 #14121c;padding:10px 20px">Tell me in the comments!</div>`;
    document.body.append(el);
    sfx.shutter();
    playBoothMusic();
  }, name === 'landscape');
  const cardAt = (Date.now() - boothAt) / 1000;
  await wait(4500);

  // Collect the sound.
  const audio = await page.evaluate(async () => {
    const p = window.__promo;
    if (!p.rec) return null;
    await new Promise((r) => {
      p.rec.onstop = r;
      p.rec.stop();
    });
    const bytes = new Uint8Array(await new Blob(p.chunks).arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
      s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { b64: btoa(s), start: p.start };
  });
  const end = (Date.now() - boothAt) / 1000;

  const video = page.video();
  await ctx.close();
  await browser.close();
  const webm = join(out, `pixel-me-in-${name}.webm`);
  rmSync(webm, { force: true });
  renameSync(await video.path(), webm);

  // Caption band: one drawtext per caption, shown until the next one.
  const W = opts.viewport.width;
  const H = opts.viewport.height + BAND;
  const draw = captions.map(([t, text], i) => {
    const file = join(out, `cap-${name}-${i}.txt`).replaceAll('\\', '/');
    writeFileSync(file, text);
    const until = captions[i + 1]?.[0] ?? end;
    return (
      `drawtext=fontfile=${FONT}:textfile=${file}:fontsize=${fontSize}:fontcolor=0xe8c547:` +
      `shadowcolor=0x14121c:shadowx=3:shadowy=3:x=(w-text_w)/2:y=(${BAND}-text_h)/2:` +
      `enable='between(t,${t.toFixed(2)},${until.toFixed(2)})'`
    );
  });
  const trim = (boothAt - videoStart) / 1000;
  const vf = [
    `[0:v]trim=start=${trim.toFixed(3)},setpts=PTS-STARTPTS`,
    `pad=${W}:${H}:0:${BAND}:color=0x1b1f3b`,
    ...draw,
    ...(scale > 1 ? [`scale=${W * scale}:${H * scale}:flags=neighbor`] : []),
  ].join(',');
  const inputs = ['-i', webm];
  let filter = `${vf}[v]`;
  const map = ['-map', '[v]'];
  if (audio) {
    const wav = join(out, `audio-${name}.webm`);
    writeFileSync(wav, Buffer.from(audio.b64, 'base64'));
    inputs.push('-i', wav);
    // Line the sound up with the picture. The recorded sound only begins with the
    // first sound played (not at the clock time), so the end-card sound, which
    // comes after the quiet game-over screen, is the marker. Fallback: the clock.
    const clock = (boothAt - audio.start) / 1000;
    const marker = soundStarts(wav).at(-1);
    // When the end card shows in the picture (the last big change), else the clock.
    const cut = sceneCuts(webm).at(-1);
    const cardShown = cut !== undefined && cut - trim > cardAt - 1.5 ? cut - trim : cardAt;
    const shift = marker !== undefined && marker > cardAt * 0.5 ? marker - cardShown : clock;
    console.log(
      `[${name}] sound: clock ${clock.toFixed(2)} s, marker ${marker?.toFixed(2)} s → shift ${shift.toFixed(2)} s`,
    );
    filter +=
      shift >= 0
        ? `;[1:a]atrim=start=${shift.toFixed(3)},asetpts=PTS-STARTPTS,${LOUD}[a]`
        : `;[1:a]adelay=${Math.round(-shift * 1000)}:all=1,${LOUD}[a]`;
    map.push('-map', '[a]', '-c:a', 'aac', '-b:a', '160k');
  } else console.log(`[${name}] no sound was recorded`);
  const mp4 = webm.replace('.webm', '.mp4');
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    ...inputs,
    '-filter_complex',
    filter,
    ...map,
    '-t',
    end.toFixed(2),
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
  for (const f of readdirSync(out))
    if (f.startsWith(`cap-${name}-`) || (f === `audio-${name}.webm` && !process.env.KEEP))
      rmSync(join(out, f));
  console.log(`wrote ${mp4} (${end.toFixed(1)} s, end card at ${cardAt.toFixed(2)} s)`);
}

/** Times (s) where the picture changes a lot (a new screen). */
function sceneCuts(file) {
  const log = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-i',
      file,
      '-an',
      '-vf',
      "select='gt(scene,0.08)',showinfo",
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  ).stderr;
  return [...log.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
}

/** Times (s) where sound starts after at least 0.4 s of silence. */
function soundStarts(file) {
  // ffmpeg prints the result on stderr.
  const log = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-45dB:d=0.4', '-f', 'null', '-'],
    { encoding: 'utf8' },
  ).stderr;
  return [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
}

const only = process.argv[4];
for (const [name, format] of Object.entries(FORMATS))
  if (!only || only === name) await record(name, format);
// Clean up stray recordings Playwright may leave behind.
for (const f of readdirSync(out)) if (/^[0-9a-f]{32}\.webm$/.test(f)) rmSync(join(out, f));
