/**
 * Score, RAM saved, power-up timer, pause button, banners and the in-game
 * teaching hints (HTML over the canvas). Touch devices see touch zones,
 * keyboards see keys – never both.
 */
import type { ChaseKind, HintKind, HudData } from '../game/events';
import { formatGB } from '../game/rules';
import { hasGamepad, isTouch } from './device';
import { padVisible, setPadShown } from './touchControls';
import { formatNumber } from './dom';

const POWER_LABEL = { shield: 'Firewall', magnet: 'RAM ×2', jetpack: 'Jetpack' } as const;

export class Hud {
  onPause: () => void = () => {};
  private metresEl!: HTMLElement;
  private gearsEl!: HTMLElement;
  private powerEl!: HTMLElement;
  private last = { metres: -1, gears: -1, power: '' };
  private lastHint: HintKind | null = null;

  constructor(private root: HTMLElement) {}

  /** `padToggle`: during the tutorial on touch screens, a chip to show/hide the buttons. */
  show(opts: { padToggle?: boolean } = {}) {
    const touch = isTouch();
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-stats">
          <span class="stat"><span data-m>0</span> m</span>
          <span class="stat"><span class="ram-ico" aria-hidden="true"></span><span data-g>0 GB</span></span>
        </div>
        <div class="hud-power" data-p></div>
        ${touch && opts.padToggle ? '<button class="pad-toggle" data-pad-toggle></button>' : ''}
        <button class="pause-btn" aria-label="Pause">
          <span aria-hidden="true">❚❚</span>${touch ? '' : '<small>Esc</small>'}
        </button>
      </div>
      <div data-banners></div>
      <div class="sr-only" aria-live="polite" data-live></div>
    `;
    this.metresEl = this.root.querySelector('[data-m]')!;
    this.gearsEl = this.root.querySelector('[data-g]')!;
    this.powerEl = this.root.querySelector('[data-p]')!;
    this.root.querySelector('.pause-btn')!.addEventListener('click', () => this.onPause());
    const toggle = this.root.querySelector<HTMLButtonElement>('[data-pad-toggle]');
    if (toggle) {
      const label = () => {
        const on = padVisible();
        toggle.textContent = on ? 'Hide buttons' : 'Show buttons';
        toggle.setAttribute('aria-pressed', String(on));
      };
      label();
      toggle.addEventListener('click', () => {
        setPadShown(!padVisible());
        label();
        // The hint text depends on the buttons ("Tap Jump" vs "Tap anywhere").
        if (this.lastHint) this.hint(this.lastHint);
      });
    }
    this.lastHint = null;
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
      this.gearsEl.textContent = formatGB(d.gears);
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

  chase(kind: ChaseKind) {
    const holder = this.root.querySelector('[data-banners]');
    if (!holder) return;
    holder.querySelector('.chase')?.remove();
    if (!kind) return;
    const el = document.createElement('div');
    el.className = 'banner chase';
    el.textContent = kind === 'rush' ? 'Idle RAM detected!' : "He's right behind you!";
    holder.append(el);
    setTimeout(() => el.remove(), 2400);
    this.say(el.textContent);
  }

  /** A short line under the score (RAM milestones, RAM grabbed). */
  toast(text: string) {
    const holder = this.root.querySelector('[data-banners]');
    if (!holder) return;
    holder.querySelector('.toast-line')?.remove();
    const el = document.createElement('div');
    el.className = 'toast-line';
    el.textContent = text;
    holder.append(el);
    setTimeout(() => el.remove(), 2600);
    this.say(text);
  }

  /** Teaching hint. On touch screens the matching half of the screen glows. */
  hint(kind: HintKind | null) {
    this.root.querySelector('.hint')?.remove();
    this.lastHint = kind;
    // Tutorial over: the buttons chip goes away (Pause menu keeps the option).
    if (kind === 'done') this.root.querySelector('[data-pad-toggle]')?.remove();
    // Touch buttons on screen: make the one to press glow.
    document.querySelectorAll('.pad-btn').forEach((b) => b.classList.remove('glow'));
    const glow = kind === 'slide' ? 'slide' : kind === 'jump' || kind === 'double' ? 'jump' : null;
    if (glow) document.querySelector(`.pad-btn[data-in="${glow}"]`)?.classList.add('glow');
    if (!kind) return;
    const el = document.createElement('div');
    el.className = `hint hint-${kind}`;
    el.innerHTML = hintHtml(kind);
    this.root.append(el);
    this.say(el.textContent ?? '');
    if (kind !== 'jump' && kind !== 'slide' && kind !== 'double' && kind !== 'power') {
      setTimeout(() => el.remove(), 1600);
    }
  }

  /** Screen readers hear the important moments. */
  private say(text: string) {
    const live = this.root.querySelector('[data-live]');
    if (live) live.textContent = text;
  }
}

function padOn() {
  return !!document.querySelector('#pad:not(.hidden)');
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
        ? padOn()
          ? 'Tap <b>Jump</b> – or tap anywhere!'
          : 'Tap anywhere to jump!'
        : pad
          ? `Press ${key('A')} to jump!`
          : `Press ${key('Space')} to jump!`;
    case 'slide':
      return touch
        ? padOn()
          ? 'Hold <b>Slide</b> – or swipe down!'
          : 'Swipe <b>down</b> to slide!'
        : pad
          ? `Hold ${key('B')} to slide!`
          : `Hold ${key('↓')} to slide!`;
    case 'double':
      return touch
        ? 'Jump, then tap <b>again</b> in the air!'
        : `Jump, then press ${key(pad ? 'A' : 'Space')} <b>again</b> in the air!`;
    case 'power':
      return 'Grab the <b>Firewall</b>! It blocks one crash.';
    case 'nice':
      return 'Nice!';
    case 'again':
      return 'Oops! Try the next one.';
    case 'done':
      return "You're ready. Run!";
    case 'laser':
      return '⚠ Utilization beam! <b>Slide</b> under it!';
    case 'bomb':
      return '⚠ Cloud drop! <b>Jump</b> over it!';
    default:
      return '';
  }
}
