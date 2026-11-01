/**
 * Where the avatar is saved: IndexedDB in this browser only.
 * Only the small 256x256 face crop is stored, never the original photo.
 * clearAllData() removes everything this game ever saved.
 */
import { clear, createStore, del, get, set } from 'idb-keyval';
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
  style: { style: 'pixel', pixelSize: 24, palette: 'game', outline: true },
  hat: null,
  faceAcc: null,
  outfit: 'tee',
};

const store = createStore('pixel-me-in', 'avatar');

export async function saveBaseFace(png: Blob): Promise<void> {
  await set('baseFace', png, store);
}

export async function loadBaseFace(): Promise<Blob | undefined> {
  return get<Blob>('baseFace', store);
}

/** Choosing a ready-made character removes the stored face crop too. */
export async function deleteBaseFace(): Promise<void> {
  await del('baseFace', store);
}

export async function saveAvatar(cfg: AvatarConfig): Promise<void> {
  await set('avatar', cfg, store);
}

export async function loadAvatar(): Promise<AvatarConfig | undefined> {
  const cfg = await get<AvatarConfig>('avatar', store);
  return cfg?.version === 1 ? { ...DEFAULT_AVATAR, ...cfg } : undefined;
}

/** "Delete my data": the face, the avatar, scores and settings. */
export async function clearAllData(): Promise<void> {
  await clear(store);
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('pmi:')) localStorage.removeItem(key);
  }
}
