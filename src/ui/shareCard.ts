/**
 * Share cards: a picture of your pixel character (and your score), made on the
 * device. Two sizes: square (posts) and 9:16 "story" (Instagram/WhatsApp/Snapchat
 * stories). The player decides whether to save or share it.
 */
import { GROUND_TILE, LAYER_SIZE, paint, ZONES } from '../art/world';
import { GAME_NAME } from '../config';
import { gameUrl } from '../creator';
import type { AvatarConfig } from '../face/faceStore';
import { canvasToBlob } from '../face/canvas';
import { renderCharacter, type FaceData } from '../face/renderAvatar';
import { formatNumber } from './dom';

export type CardFormat = 'square' | 'story';
export interface Score {
  metres: number;
  gears: number;
}

const FONT = '"Pixelify Sans", ui-monospace, Menlo, monospace';

export async function makeCard(
  base: FaceData,
  cfg: AvatarConfig,
  score?: Score,
  format: CardFormat = 'square',
): Promise<HTMLCanvasElement> {
  // The pixel font is self-hosted; make sure it is ready before drawing text.
  await document.fonts?.load(`700 64px ${FONT}`).catch(() => {});
  const W = format === 'story' ? 1080 : 720;
  const H = format === 'story' ? 1920 : 720;
  const k = format === 'story' ? 3 : 2; // pixel size of the scenery
  const zone = ZONES[0];
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Scenery: sky, far/mid layers, ground down to the bottom edge.
  const groundY = format === 'story' ? 1420 : 560;
  ctx.drawImage(paint(Math.ceil(W / k), Math.ceil(groundY / k), zone.sky), 0, 0, W, groundY);
  const far = paint(LAYER_SIZE.w, LAYER_SIZE.h, zone.far);
  const mid = paint(LAYER_SIZE.w, LAYER_SIZE.h, zone.mid);
  for (let x = -60; x < W; x += LAYER_SIZE.w * k) {
    ctx.drawImage(far, x, groundY - LAYER_SIZE.h * k - 20 * k, LAYER_SIZE.w * k, LAYER_SIZE.h * k);
    ctx.drawImage(
      mid,
      x - 40,
      groundY - LAYER_SIZE.h * k + 10 * k,
      LAYER_SIZE.w * k,
      LAYER_SIZE.h * k,
    );
  }
  const ground = paint(GROUND_TILE.w, GROUND_TILE.h, zone.ground);
  ctx.fillStyle = '#6b4c33';
  ctx.fillRect(0, groundY, W, H - groundY);
  for (let x = 0; x < W; x += GROUND_TILE.w * k) {
    ctx.drawImage(ground, x, groundY, GROUND_TILE.w * k, GROUND_TILE.h * k);
  }

  // The character, big.
  const ch = renderCharacter(base, cfg, format === 'story' ? 9 : 5, 'run1');
  ctx.drawImage(ch, (W - ch.width) / 2, groundY - ch.height + k);

  // Text with a hard pixel shadow.
  const text = (s: string, y: number, size: number, colour = '#f4f1e8') => {
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#14121c';
    ctx.fillText(s, W / 2 + size / 12, y + size / 12);
    ctx.fillStyle = colour;
    ctx.fillText(s, W / 2, y);
  };
  const story = format === 'story';
  text(GAME_NAME, story ? 170 : 80, story ? 110 : 56, '#e8c547');
  if (score) {
    text(`I ran ${formatNumber(score.metres)} m`, story ? 330 : 145, story ? 104 : 46);
    text(`and grabbed ${score.gears} gears`, story ? 430 : 192, story ? 56 : 28);
    text('Can you beat me?', story ? 560 : 240, story ? 72 : 32, '#9cf3ff');
  } else {
    text('Me, pixelated.', story ? 320 : 140, story ? 88 : 38);
    text('Put your face in the game!', story ? 420 : 186, story ? 52 : 24, '#9cf3ff');
  }
  // Footer band with the link.
  const band = story ? 150 : 56;
  ctx.fillStyle = 'rgba(20,18,28,0.85)';
  ctx.fillRect(0, H - band, W, band);
  const host = new URL(gameUrl()).host || 'pixel-me-in';
  text(`Play free: ${host}`, H - band / 2 + (story ? 18 : 9), story ? 52 : 24);
  return c;
}

export async function downloadCard(card: HTMLCanvasElement, name = 'pixel-me-in.png') {
  const blob = await canvasToBlob(card);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
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

/** Uses the phone's share menu (Instagram, WhatsApp, Snapchat, …). Only runs when the player taps Share. */
export async function shareCardFile(card: HTMLCanvasElement, text: string) {
  const blob = await canvasToBlob(card);
  const file = new File([blob], 'pixel-me-in.png', { type: 'image/png' });
  try {
    await navigator.share({ files: [file], title: GAME_NAME, text });
  } catch (e) {
    if ((e as Error).name !== 'AbortError') await downloadCard(card);
  }
}
