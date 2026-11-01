/**
 * Score, gears, power-up timer, pause button, banners and the in-game
 * teaching hints (HTML over the canvas). Touch devices see touch zones,
 * keyboards see keys – never both.
 */
import type { HintKind, HudData } from '../game/events';
import { hasGamepad, isTouch } from './device';
import { formatNumber } from './dom';

const POWER_LABEL = { shield: 'Shield', magnet: 'Magnet', jetpack: 'Jetpack' } as const;

export class Hud {
  onPause: () => void = () => {};
  private metresEl!: HTMLElement;
  private gearsEl!: HTMLElement;
  private powerEl!: HTMLElement;
  private last = { metres: -1, gears: -1, power: '' };

  constructor(private root: HTMLElement) {}

  show() {
    const touch = isTouch();
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-stats">
          <span class="stat"><span data-m>0</span> m</span>
          <span class="stat">⚙ <span data-g>0</span></span>
        </div>
        <div class="hud-power" data-p></div>
        <button class="pause-btn" aria-label="Pause">
          <span aria-hidden="true">❚❚</span>${touch ? '' : '<small>Esc</small>'}
        </button>
      </div>
      <div data-banners></div>
      <div class="touch-guide hidden" aria-hidden="true">
        <div class="zone left"><span>HOLD<br>to slide</span></div>
        <div class="zone right"><span>TAP<br>to jump</span></div>
      </div>
      <div class="sr-only" aria-live="polite" data-live></div>
    `;
    this.metresEl = this.root.querySelector('[data-m]')!;
    this.gearsEl = this.root.querySelector('[data-g]')!;
    this.powerEl = this.root.querySelector('[data-p]')!;
    this.root.querySelector('.pause-btn')!.addEventListener('click', () => this.onPause());
    this.last = { metres: -1, gears: -1, power: '' };
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
  }

  update(d: HudData) {
    if (!this.metresEl) return;
    if (d.metres !== this.last.metres) this.metresEl.textContent = formatNumber(d.metres);
    if (d.gears !== this.last.gears) {
      this.gearsEl.textContent = String(d.gears);
      if (d.gears > 0) bump(this.gearsEl.parentElement!);
    }
    const p = d.power ?? '';
    if (p !== this.last.power) {
      this.powerEl.innerHTML = d.power
        ? `<span>${POWER_LABEL[d.power]}</span>${d.power === 'shield' ? '' : '<span class="bar"><i></i></span>'}`
        : '';
    }
    const bar = this.powerEl.querySelector<HTMLElement>('.bar i');
    if (bar) bar.style.width = `${Math.round(d.powerLeft * 100)}%`;
    this.last = { metres: d.metres, gears: d.gears, power: p };
  }

  /** Big centre text ("Ready…", "GO!"). */
  announce(text: string) {
    const holder = this.root.querySelector('[data-banners]');
    if (!holder) return;
    holder.querySelector('.announce')?.remove();
    const el = document.createElement('div');
    el.className = 'announce';
    el.textContent = text;
    holder.append(el);
    setTimeout(() => el.remove(), 800);
  }

  banner(text: string, zoneIndex: number) {
    const holder = this.root.querySelector('[data-banners]');
    if (!holder) return;
    const el = document.createElement('div');
    el.className = 'banner';
    el.textContent =
      zoneIndex === 0 ? `Zone 1: ${text}` : `Zapped to zone ${zoneIndex + 1}: ${text}`;
    holder.append(el);
    setTimeout(() => el.remove(), 2200);
    this.say(el.textContent);
  }

  chase(on: boolean) {
    const holder = this.root.querySelector('[data-banners]');
    if (!holder) return;
    holder.querySelector('.chase')?.remove();
    if (on) {
      const el = document.createElement('div');
      el.className = 'banner chase';
      el.textContent = 'Robot chase!';
      holder.append(el);
      setTimeout(() => el.remove(), 2400);
      this.say('Robot chase!');
    }
  }

  /** Teaching hint. On touch screens the matching half of the screen glows. */
  hint(kind: HintKind | null) {
    this.root.querySelector('.hint')?.remove();
    const guide = this.root.querySelector<HTMLElement>('.touch-guide');
    const touch = isTouch();
    if (guide) {
      const zone =
        kind === 'slide' ? 'left' : kind === 'jump' || kind === 'double' ? 'right' : null;
      guide.classList.toggle('hidden', !touch || !zone);
      guide.dataset.zone = zone ?? '';
    }
    if (!kind) return;
    const el = document.createElement('div');
    el.className = `hint hint-${kind}`;
    el.innerHTML = hintHtml(kind);
    this.root.append(el);
    this.say(el.textContent ?? '');
    if (kind === 'done' || kind === 'again' || kind === 'nice') setTimeout(() => el.remove(), 1600);
  }

  /** Screen readers hear the important moments. */
  private say(text: string) {
    const live = this.root.querySelector('[data-live]');
    if (live) live.textContent = text;
  }
}

function bump(el: HTMLElement) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

const key = (k: string) => `<kbd>${k}</kbd>`;

function hintHtml(kind: HintKind): string {
  const touch = isTouch();
  const pad = hasGamepad();
  switch (kind) {
    case 'jump':
      return touch
        ? 'Tap the <b>right</b> side to jump!'
        : pad
          ? `Press ${key('A')} to jump!`
          : `Press ${key('Space')} to jump!`;
    case 'slide':
      return touch
        ? 'Hold the <b>left</b> side to slide!'
        : pad
          ? `Hold ${key('B')} to slide!`
          : `Hold ${key('↓')} to slide!`;
    case 'double':
      return touch
        ? 'Jump, then tap <b>again</b> in the air!'
        : `Jump, then press ${key(pad ? 'A' : 'Space')} <b>again</b> in the air!`;
    case 'power':
      return 'Grab the power-up! 🛡️ It saves you from one crash.';
    case 'nice':
      return 'Nice!';
    case 'again':
      return 'Oops! Try the next one.';
    case 'done':
      return "You're ready. Run!";
    default:
      return '';
  }
}
