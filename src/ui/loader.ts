/**
 * Loading screen in the game's style: the character runs while a "digitizing"
 * bar fills. Shown while the game engine or the face finder loads.
 */
import type { AvatarConfig } from '../face/faceStore';
import type { FaceData } from '../face/renderAvatar';
import { getSettings } from '../storage/local';
import { defaultCharacter, startMiniScene } from './miniScene';

export interface Loader {
  element: HTMLElement;
  setText(text: string): void;
  close(): void;
}

export function showLoader(
  parent: HTMLElement,
  text: string,
  who?: { face: FaceData; cfg: AvatarConfig },
): Loader {
  const el = document.createElement('div');
  el.className = 'loader';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="loader-screen"><canvas aria-hidden="true"></canvas><div class="scan" aria-hidden="true"></div></div>
    <p class="loader-text"></p>
    <div class="loader-bar" aria-hidden="true"><i></i></div>`;
  parent.append(el);
  const label = el.querySelector<HTMLElement>('.loader-text')!;
  label.textContent = text;
  const { face, cfg } = who ?? defaultCharacter();
  const stop = startMiniScene(el.querySelector('canvas')!, face, cfg, getSettings().reducedMotion);
  return {
    element: el,
    setText: (t) => (label.textContent = t),
    close: () => {
      stop();
      el.remove();
    },
  };
}
