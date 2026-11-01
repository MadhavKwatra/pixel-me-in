/** Score, gears, power-up timer, pause button, zone banners and tutorial hints (HTML over the canvas). */
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

  show(showTouchZones: boolean) {
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-stats">
          <span><span data-m>0</span> m</span>
          <span>⚙ <span data-g>0</span></span>
        </div>
        <div class="hud-power" data-p></div>
        <button class="pause-btn" aria-label="Pause">II</button>
      </div>
      <div data-banners></div>
      <div class="sr-only" aria-live="polite" data-live></div>
      ${showTouchZones ? '<div class="touch-zones" aria-hidden="true"><div>Hold: slide</div><div>Tap: jump</div></div>' : ''}
    `;
    this.metresEl = this.root.querySelector('[data-m]')!;
    this.gearsEl = this.root.querySelector('[data-g]')!;
    this.powerEl = this.root.querySelector('[data-p]')!;
    this.root.querySelector('.pause-btn')!.addEventListener('click', () => this.onPause());
    this.last = { metres: -1, gears: -1, power: '' };
    this.root.classList.remove('hidden');
    const zones = this.root.querySelector('.touch-zones');
    if (zones) setTimeout(() => zones.remove(), 4000);
  }

  hide() {
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
  }

  update(d: HudData) {
    if (!this.metresEl) return;
    if (d.metres !== this.last.metres) this.metresEl.textContent = formatNumber(d.metres);
    if (d.gears !== this.last.gears) this.gearsEl.textContent = String(d.gears);
    const p = d.power ?? '';
    if (p !== this.last.power) {
      this.powerEl.innerHTML = d.power
        ? `<span>${POWER_LABEL[d.power]}</span><span class="bar"><i></i></span>`
        : '';
    }
    const bar = this.powerEl.querySelector<HTMLElement>('.bar i');
    if (bar) bar.style.width = `${Math.round(d.powerLeft * 100)}%`;
    this.last = { metres: d.metres, gears: d.gears, power: p };
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

  hint(kind: HintKind | null) {
    this.root.querySelector('.hint')?.remove();
    if (!kind) return;
    const text = hintText(kind);
    const el = document.createElement('div');
    el.className = 'hint';
    el.textContent = text;
    this.root.append(el);
    this.say(text);
    if (kind === 'done' || kind === 'again') setTimeout(() => el.remove(), 1800);
  }

  /** Screen readers hear the important moments. */
  private say(text: string) {
    const live = this.root.querySelector('[data-live]');
    if (live) live.textContent = text;
  }
}

function hintText(kind: HintKind): string {
  const touch = isTouch();
  const pad = hasGamepad();
  switch (kind) {
    case 'jump':
      return touch
        ? 'Tap the RIGHT side to jump!'
        : pad
          ? 'Press A to jump!'
          : 'Press SPACE to jump!';
    case 'slide':
      return touch
        ? 'Hold the LEFT side to slide!'
        : pad
          ? 'Press B to slide!'
          : 'Hold ↓ to slide!';
    case 'again':
      return 'Oops! Try the next one.';
    case 'done':
      return "Nice! You're ready. Go!";
  }
}
