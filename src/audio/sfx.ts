/**
 * Tiny chiptune sound effects made with the Web Audio API (no sound files).
 * Browsers only allow audio after a tap/click, so unlockAudio() is called
 * from the first button press.
 */
let ac: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}

/** Shared audio context (used by the music player too). */
export function getAudioContext(): AudioContext | null {
  return ac;
}

export function unlockAudio() {
  if (!ac) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ac = new Ctor();
  }
  if (ac.state === 'suspended') void ac.resume();
}

function tone(
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; to?: number; vol?: number; delay?: number } = {},
) {
  if (muted || !ac) return;
  const t0 = ac.currentTime + (opts.delay ?? 0);
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = opts.type ?? 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
  gain.gain.setValueAtTime(opts.vol ?? 0.08, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol = 0.12) {
  if (muted || !ac) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  gain.gain.value = vol;
  src.buffer = buf;
  src.connect(gain).connect(ac.destination);
  src.start();
}

export const sfx = {
  click: () => tone(660, 0.05, { vol: 0.05 }),
  jump: () => tone(300, 0.15, { to: 620 }),
  doubleJump: () => tone(450, 0.12, { to: 900 }),
  slide: () => tone(200, 0.12, { type: 'triangle', to: 120 }),
  gear: () => {
    tone(988, 0.06, { vol: 0.06 });
    tone(1319, 0.08, { vol: 0.06, delay: 0.05 });
  },
  power: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.08, { delay: i * 0.06 })),
  shieldBreak: () => tone(800, 0.25, { type: 'sawtooth', to: 200, vol: 0.06 }),
  hit: () => {
    noise(0.3);
    tone(220, 0.35, { type: 'sawtooth', to: 55 });
  },
  zap: () => tone(120, 0.6, { type: 'sawtooth', to: 1800, vol: 0.05 }),
  shutter: () => noise(0.08, 0.2),
  robot: () => tone(90, 0.3, { type: 'square', to: 60, vol: 0.06 }),
  land: () => tone(140, 0.06, { type: 'triangle', to: 90, vol: 0.05 }),
  ready: () => tone(523, 0.12, { vol: 0.06 }),
  go: () => {
    tone(784, 0.1, { vol: 0.07 });
    tone(1047, 0.18, { vol: 0.07, delay: 0.1 });
  },
  dissolve: () => tone(900, 0.5, { type: 'square', to: 120, vol: 0.05 }),
};
