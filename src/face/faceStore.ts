/**
 * Where the avatar is saved: IndexedDB in this browser only.
 * Only the small 256x256 face crop is stored, never the original photo.
 * clearAllData() removes everything this game ever saved.
 */
import { clear, createStore, del, get, set } from 'idb-keyval';
import type { FaceMeta } from './geometry';
import type { StyleOptions } from './stylize';

export type HatId = 'cap' | 'helmet' | 'spaceHelmet' | 'crown' | 'headphones';
export type FaceAccId = 'sunglasses' | 'mask' | 'moustache' | 'glasses3d';
export type OutfitId = 'tee' | 'hoodie' | 'skater' | 'spacesuit' | 'labcoat';

export interface AvatarConfig {
  version: 1;
  /** 'photo' uses the stored face crop; 'preset' draws a ready-made face. */
  source: 'photo' | 'preset';
  presetId: number;
  style: StyleOptions;
  hat: HatId | null;
  faceAcc: FaceAccId | null;
  outfit: OutfitId;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  version: 1,
  source: 'preset',
  presetId: 0,
  style: { style: 'pixel', pixelSize: 48, palette: 'natural', outline: true },
  hat: null,
  faceAcc: null,
  outfit: 'tee',
};

const store = createStore('pixel-me-in', 'avatar');

/** The face crop (PNG, transparent outside the head) + where the eyes/mouth are in it. */
export async function saveBaseFace(png: Blob, meta: FaceMeta): Promise<void> {
  await set('baseFace', png, store);
  await set('faceMeta', meta, store);
}

export async function loadBaseFace(): Promise<{ png: Blob; meta?: FaceMeta } | undefined> {
  const png = await get<Blob>('baseFace', store);
  if (!png) return undefined;
  return { png, meta: await get<FaceMeta>('faceMeta', store) };
}

/** Choosing a ready-made character removes the stored face crop too. */
export async function deleteBaseFace(): Promise<void> {
  await del('baseFace', store);
  await del('faceMeta', store);
}

export async function saveAvatar(cfg: AvatarConfig): Promise<void> {
  await set('avatar', cfg, store);
}

export async function loadAvatar(): Promise<AvatarConfig | undefined> {
  const cfg = await get<AvatarConfig>('avatar', store);
  if (cfg?.version !== 1) return undefined;
  // Older saves used options that no longer exist (small pixel sizes, "full" colours).
  // Faces only stay recognizable at 48 pixels, so the player no longer picks a size.
  const style = { ...DEFAULT_AVATAR.style, ...cfg.style, pixelSize: 48 as const };
  if (!['natural', 'game', 'grey', 'retro'].includes(style.palette)) style.palette = 'natural';
  return { ...DEFAULT_AVATAR, ...cfg, style };
}

/** "Delete my data": the face, the avatar, scores and settings. */
export async function clearAllData(): Promise<void> {
  await clear(store);
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('pmi:')) localStorage.removeItem(key);
  }
}
