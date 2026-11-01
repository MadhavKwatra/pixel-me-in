/**
 * Photo Booth: change the look of your character and save/share a picture.
 * Every change is saved right away (IndexedDB, on this device).
 */
import { sfx } from '../../audio/sfx';
import { OUTFIT_LABELS } from '../../art/body';
import { FACE_ACCESSORIES, HATS } from '../../face/accessories';
import { saveAvatar, type AvatarConfig, type OutfitId } from '../../face/faceStore';
import type { PaletteId } from '../../face/palettes';
import { PRESETS } from '../../face/presets';
import { renderCharacter } from '../../face/renderAvatar';
import { PIXEL_SIZES, type PixelSize } from '../../face/stylize';
import { getStats } from '../../storage/local';
import { isUnlocked, unlockHint } from '../../storage/unlocks';
import type { Screen } from '../app';
import { onActions, render } from '../dom';
import { canShareFiles, downloadCard, makeCard, shareCard } from '../shareCard';

const SIZE_LABEL: Record<PixelSize, string> = { 16: 'Retro', 24: 'Classic', 48: 'Fine' };
const PALETTE_LABEL: Record<PaletteId, string> = {
  natural: 'Natural',
  game: 'Game colours',
  grey: 'Grey',
  retro: 'Retro green',
};

interface Option {
  value: string;
  label: string;
  locked?: string;
}

function group(
  legend: string,
  field: string,
  options: Option[],
  current: string,
  disabled = false,
) {
  return `<fieldset ${disabled ? 'disabled' : ''}>
    <legend>${legend}</legend>
    <div class="choices">
      ${options
        .map(
          (o) =>
            `<button type="button" class="choice" data-action="set" data-field="${field}" data-value="${o.value}"
              aria-pressed="${o.value === current}" ${o.locked ? `disabled title="Locked: ${o.locked}"` : ''}>
              ${o.locked ? '🔒 ' : ''}${o.label}</button>`,
        )
        .join('')}
    </div>
    ${
      options.some((o) => o.locked)
        ? `<p class="note">🔒 ${options
            .filter((o) => o.locked)
            .map((o) => `${o.label}: ${o.locked}`)
            .join(' · ')}</p>`
        : ''
    }
  </fieldset>`;
}

export const editorScreen: Screen = (app, root) => {
  if (!app.avatar || !app.base) {
    app.go('photo');
    return;
  }
  const stats = getStats();
  const lock = (id: string) => (isUnlocked(id, stats) ? undefined : unlockHint(id));

  const draw = () => {
    const cfg = app.avatar!;
    const s = cfg.style;
    render(
      root,
      `<div class="panel panel-wide">
        <h2>Photo Booth</h2>
        <div class="editor">
          <div class="stack">
            <div class="stage"><canvas width="1" height="1" aria-label="Your character preview"></canvas></div>
            <div class="row center">
              <button class="btn" data-action="download">Save picture</button>
              ${canShareFiles() ? '<button class="btn btn-teal" data-action="share">Share</button>' : ''}
            </div>
          </div>
          <div class="stack">
            ${group(
              'Look',
              'style',
              [
                { value: 'pixel', label: 'Pixel' },
                { value: 'original', label: 'Photo' },
              ],
              s.style,
            )}
            ${group(
              'Pixel size',
              'pixelSize',
              PIXEL_SIZES.map((p) => ({ value: String(p), label: SIZE_LABEL[p] })),
              String(s.pixelSize),
              s.style !== 'pixel',
            )}
            ${group(
              'Colours',
              'palette',
              (Object.keys(PALETTE_LABEL) as PaletteId[]).map((p) => ({
                value: p,
                label: PALETTE_LABEL[p],
              })),
              s.palette,
            )}
            ${group(
              'Outline',
              'outline',
              [
                { value: 'true', label: 'On' },
                { value: 'false', label: 'Off' },
              ],
              String(s.outline),
            )}
            ${group('Hat', 'hat', [{ value: '', label: 'None' }, ...HATS.map((h) => ({ value: h.id, label: h.label, locked: lock(h.id) }))], cfg.hat ?? '')}
            ${group('Face', 'faceAcc', [{ value: '', label: 'None' }, ...FACE_ACCESSORIES.map((a) => ({ value: a.id, label: a.label, locked: lock(a.id) }))], cfg.faceAcc ?? '')}
            ${group(
              'Outfit',
              'outfit',
              (Object.keys(OUTFIT_LABELS) as OutfitId[]).map((o) => ({
                value: o,
                label: OUTFIT_LABELS[o],
                locked: lock(o),
              })),
              cfg.outfit,
            )}
            ${
              cfg.source === 'preset'
                ? group(
                    'Character',
                    'presetId',
                    PRESETS.map((_, i) => ({ value: String(i), label: String(i + 1) })),
                    String(cfg.presetId),
                  )
                : ''
            }
          </div>
        </div>
        <div class="row center" style="margin-top:1rem">
          <button class="btn btn-big" data-action="play">▶ Play</button>
          <button class="btn btn-ghost" data-action="newPhoto">${cfg.source === 'photo' ? 'New photo' : 'Use a photo'}</button>
          <button class="btn btn-ghost" data-action="menu">Menu</button>
        </div>
      </div>`,
    );
    const canvas = root.querySelector<HTMLCanvasElement>('.stage canvas')!;
    const ch = renderCharacter(app.base!, cfg, 4);
    canvas.width = ch.width;
    canvas.height = ch.height;
    canvas.getContext('2d')!.drawImage(ch, 0, 0);
  };

  const set = async (field: string, value: string) => {
    const cfg: AvatarConfig = { ...app.avatar!, style: { ...app.avatar!.style } };
    switch (field) {
      case 'style':
        cfg.style.style = value as 'pixel' | 'original';
        break;
      case 'pixelSize':
        cfg.style.pixelSize = Number(value) as PixelSize;
        break;
      case 'palette':
        cfg.style.palette = value as PaletteId;
        break;
      case 'outline':
        cfg.style.outline = value === 'true';
        break;
      case 'hat':
        cfg.hat = (value || null) as AvatarConfig['hat'];
        break;
      case 'faceAcc':
        cfg.faceAcc = (value || null) as AvatarConfig['faceAcc'];
        break;
      case 'outfit':
        cfg.outfit = value as OutfitId;
        break;
      case 'presetId':
        cfg.presetId = Number(value);
        break;
    }
    sfx.click();
    await saveAvatar(cfg);
    if (field === 'presetId') await app.refreshAvatar();
    else app.avatar = cfg;
    const focusKey = `[data-field="${field}"][data-value="${value}"]`;
    draw();
    root.querySelector<HTMLElement>(focusKey)?.focus();
  };

  onActions(root, {
    set: (el) => void set(el.dataset.field!, el.dataset.value!),
    download: () => void downloadCard(makeCard(app.base!, app.avatar!)),
    share: () => void shareCard(makeCard(app.base!, app.avatar!), 'Me, pixelated!'),
    play: () => void app.play(),
    newPhoto: () => app.go('photo'),
    menu: () => app.go('menu'),
  });

  draw();
};
