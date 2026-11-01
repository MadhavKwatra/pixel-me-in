/**
 * The "digitizer" intro: flash, your face breaks into pixels, then ZAP – you
 * are in the game. A nod to the episode that inspired this game.
 */
import { sfx } from '../audio/sfx';
import type { AvatarConfig } from '../face/faceStore';
import { renderHead } from '../face/renderAvatar';
import type { Pixels } from '../face/stylize';
import { flash, wait } from './dom';

export async function playDigitizer(
  root: HTMLElement,
  base: Pixels,
  cfg: AvatarConfig,
  reducedMotion: boolean,
) {
  const box = document.createElement('div');
  box.className = 'digitizer';
  box.innerHTML =
    '<canvas width="1" height="1"></canvas><p>Digitizing…</p><div class="scan"></div>';
  root.append(box);
  const canvas = box.querySelector('canvas')!;
  const label = box.querySelector('p')!;

  const show = (c: HTMLCanvasElement) => {
    canvas.width = c.width;
    canvas.height = c.height;
    canvas.getContext('2d')!.drawImage(c, 0, 0);
  };

  // From photo-like to chunky pixels, then to the player's chosen look.
  const steps: AvatarConfig['style'][] = [
    { ...cfg.style, style: 'original', palette: 'full' },
    { ...cfg.style, style: 'pixel', pixelSize: 48 },
    { ...cfg.style, style: 'pixel', pixelSize: 24 },
    { ...cfg.style, style: 'pixel', pixelSize: 12 },
    cfg.style,
  ];

  if (reducedMotion) {
    show(renderHead(base, cfg, 4));
    label.textContent = 'Ready!';
    await wait(500);
    box.remove();
    return;
  }

  sfx.shutter();
  flash();
  for (const style of steps) {
    show(renderHead(base, { ...cfg, style }, 4));
    await wait(170);
  }
  label.textContent = 'ZAP!';
  sfx.zap();
  canvas.animate(
    [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(0.2) translateY(60%)', opacity: 0 },
    ],
    { duration: 420, easing: 'ease-in', fill: 'forwards' },
  );
  await wait(380);
  flash();
  box.remove();
}
