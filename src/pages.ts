/**
 * Script for the detail pages (How to play, Privacy, About). Plain HTML pages;
 * this only adds the styles, offline support and device-first controls.
 */
import './styles.css';
import { hasGamepad, isTouch } from './ui/device';
import { setupPwa } from './ui/pwa';

setupPwa();

// How to play: show the controls for this device first, the others folded away.
const box = document.querySelector<HTMLElement>('[data-controls]');
if (box) {
  const mine = hasGamepad() ? 'pad' : isTouch() ? 'touch' : 'keys';
  const sets = Array.from(box.querySelectorAll<HTMLElement>('[data-device]'));
  const others = document.createElement('details');
  others.innerHTML = '<summary>Other controls</summary>';
  for (const s of sets) if (s.dataset.device !== mine) others.append(s);
  box.append(others);
}
