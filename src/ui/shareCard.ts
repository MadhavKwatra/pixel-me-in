/**
 * Share cards: a square picture of your pixel character (and your score).
 * Made on the device; the player decides whether to download or share it.
 */
import { GROUND_TILE, LAYER_SIZE, paint, ZONES } from '../art/world';
import { GAME_NAME } from '../config';
import type { AvatarConfig } from '../face/faceStore';
import { canvasToBlob } from '../face/canvas';
import { renderCharacter } from '../face/renderAvatar';
import type { Pixels } from '../face/stylize';
import { formatNumber } from './dom';

const SIZE = 720;

export function makeCard(
  base: Pixels,
  cfg: AvatarConfig,
  score?: { metres: number; gears: number },
): HTMLCanvasElement {
  const zone = ZONES[0];
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Scenery, scaled up 2x for chunky pixels.
  const groundY = 560;
  ctx.drawImage(paint(SIZE / 2, SIZE / 2, zone.sky), 0, 0, SIZE, SIZE);
  const far = paint(LAYER_SIZE.w, LAYER_SIZE.h, zone.far);
  const mid = paint(LAYER_SIZE.w, LAYER_SIZE.h, zone.mid);
  ctx.drawImage(far, 0, groundY - LAYER_SIZE.h * 2 - 40, LAYER_SIZE.w * 2, LAYER_SIZE.h * 2);
  ctx.drawImage(mid, -100, groundY - LAYER_SIZE.h * 2 + 20, LAYER_SIZE.w * 2, LAYER_SIZE.h * 2);
  const ground = paint(GROUND_TILE.w, GROUND_TILE.h, zone.ground);
  for (let x = 0; x < SIZE; x += GROUND_TILE.w * 2)
    ctx.drawImage(ground, x, groundY, GROUND_TILE.w * 2, GROUND_TILE.h * 3);

  // The character, big.
  const scale = 5;
  const ch = renderCharacter(base, cfg, scale, 'run1');
  ctx.drawImage(ch, (SIZE - ch.width) / 2, groundY - ch.height + 2);

  // Text with a hard pixel shadow.
  const text = (s: string, y: number, size: number, colour = '#f4f1e8') => {
    ctx.font = `800 ${size}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#14121c';
    ctx.fillText(s, SIZE / 2 + 4, y + 4);
    ctx.fillStyle = colour;
    ctx.fillText(s, SIZE / 2, y);
  };
  text(GAME_NAME.toUpperCase(), 70, 48, '#e8c547');
  if (score) {
    text(`I ran ${formatNumber(score.metres)} m`, 125, 36);
    text(`and grabbed ${score.gears} gears`, 165, 26);
  } else {
    text('Me, pixelated.', 120, 32);
  }
  ctx.font = '600 20px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = '#f4f1e8';
  ctx.fillText(location.host || 'pixel-me-in', SIZE / 2, SIZE - 24);
  return c;
}

export async function downloadCard(card: HTMLCanvasElement) {
  const blob = await canvasToBlob(card);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pixel-me-in.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function canShareFiles(): boolean {
  try {
    const f = new File([''], 'x.png', { type: 'image/png' });
    return !!navigator.canShare?.({ files: [f] });
  } catch {
    return false;
  }
}

/** Uses the phone's share sheet. Only runs when the player taps Share. */
export async function shareCard(card: HTMLCanvasElement, text: string) {
  const blob = await canvasToBlob(card);
  const file = new File([blob], 'pixel-me-in.png', { type: 'image/png' });
  try {
    await navigator.share({ files: [file], title: GAME_NAME, text });
  } catch (e) {
    if ((e as Error).name !== 'AbortError') await downloadCard(card);
  }
}
