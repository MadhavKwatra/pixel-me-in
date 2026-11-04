// Shared helpers for the promo tools (promo-video, promo-reel, promo-images).
// Dev only: they drive the real game in Playwright and use ffmpeg.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

export const FONT = 'public/fonts/PixelifySans.ttf';
// The game is quiet on purpose; videos get normal loudness (like other social clips).
// The limit is low because AAC overshoots on sharp chiptune waves.
export const LOUD =
  'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.55:level=disabled';

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs in the page before anything else: every Web Audio context also feeds a
 * MediaRecorder, so the game's own sounds and music end up in the video.
 * `promo.music === false` (set by the caller) turns the game music off.
 */
export function tapAudio(opts = {}) {
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
  if (opts.music === false) {
    const key = 'pmi:settings';
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(key) ?? '{}');
    } catch {
      saved = null;
    }
    localStorage.setItem(key, JSON.stringify({ ...saved, music: false }));
  }
}

/** Landing → photo → "Line it up" → Photo Booth. */
export async function openBooth(page, url, photo) {
  await page.goto(url);
  await page
    .getByRole('button', { name: /play now/i })
    .first()
    .click();
  await page.locator('input[type=file]').setInputFiles(photo);
  await page.getByRole('heading', { name: 'Line it up' }).waitFor({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Use this', exact: true }).click();
  await page.getByRole('heading', { name: 'Photo Booth' }).waitFor();
}

/** Stops the page's sound recorder and returns { b64, start } (or null if nothing played). */
export async function collectAudio(page) {
  return page.evaluate(async () => {
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
}

/** Writes a `data:image/png;base64,…` URL to a file. */
export function writeDataUrl(file, dataUrl) {
  writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

/** Times (s) where the picture changes a lot (a new screen). */
export function sceneCuts(file, threshold = 0.08) {
  const log = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-i',
      file,
      '-an',
      '-vf',
      `select='gt(scene,${threshold})',showinfo`,
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  ).stderr;
  return [...log.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
}

/** Times (s) where sound starts after at least `quiet` s of silence. */
export function soundStarts(file, quiet = 0.4) {
  // ffmpeg prints the result on stderr.
  const log = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', file, '-af', `silencedetect=noise=-45dB:d=${quiet}`, '-f', 'null', '-'],
    { encoding: 'utf8' },
  ).stderr;
  return [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
}
