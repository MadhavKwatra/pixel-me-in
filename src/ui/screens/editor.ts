/**
 * Photo Booth: change the look of your character and save/share a picture.
 * Tabs with picture buttons; every change is saved right away (IndexedDB, on this device).
 */
import { sfx } from '../../audio/sfx';
import { OUTFIT_LABELS, RUN_FRAMES } from '../../art/body';
import { FACE_ACCESSORIES, HATS } from '../../face/accessories';
import { saveAvatar, type AvatarConfig, type OutfitId } from '../../face/faceStore';
import type { PaletteId } from '../../face/palettes';
import { PRESETS } from '../../face/presets';
import { renderFrames, renderHead } from '../../face/renderAvatar';
import type { FaceStyle } from '../../face/stylize';
import { getSettings, getStats } from '../../storage/local';
import { isUnlocked, unlockHint } from '../../storage/unlocks';
import type { Screen } from '../app';
import { escapeHtml, onActions, render } from '../dom';
import { canShareFiles, downloadCard, makeCard, shareCard } from '../shareCard';

type Tab = 'look' | 'hat' | 'face' | 'outfit' | 'character';

interface Option {
  field: string;
  value: string;
  label: string;
  /** Config to draw the thumbnail with. */
  preview: Partial<AvatarConfig>;
  locked?: string;
  /** Thumbnail shows the whole body instead of the head. */
  body?: boolean;
}

const STYLES: [FaceStyle, string][] = [
  ['pixel', 'Pixel'],
  ['cartoon', 'Cartoon'],
  ['original', 'Photo'],
];

const PALETTES: [PaletteId, string][] = [
  ['natural', 'Natural'],
  ['game', 'Game colours'],
  ['grey', 'Grey'],
  ['retro', 'Retro green'],
];

export const editorScreen: Screen = (app, root) => {
  if (!app.avatar || !app.base) {
    app.go('photo');
    return;
  }
  const stats = getStats();
  const lock = (id: string) => (isUnlocked(id, stats) ? undefined : unlockHint(id));
  let tab: Tab = 'look';
  let animTimer = 0;

  const optionsFor = (t: Tab, cfg: AvatarConfig): { title: string; options: Option[] }[] => {
    const style = (s: Partial<AvatarConfig['style']>) => ({ style: { ...cfg.style, ...s } });
    switch (t) {
      case 'look':
        return [
          {
            title: 'Style',
            options: STYLES.map(([v, label]) => ({
              field: 'style',
              value: v,
              label,
              preview: style({ style: v }),
            })),
          },
          {
            title: 'Colours',
            options: PALETTES.map(([v, label]) => ({
              field: 'palette',
              value: v,
              label,
              preview: style({ palette: v }),
            })),
          },
          {
            title: 'Outline',
            options: [
              { field: 'outline', value: 'true', label: 'On', preview: style({ outline: true }) },
              {
                field: 'outline',
                value: 'false',
                label: 'Off',
                preview: style({ outline: false }),
              },
            ],
          },
        ];
      case 'hat':
        return [
          {
            title: 'Hat',
            options: [
              { field: 'hat', value: '', label: 'None', preview: { hat: null } },
              ...HATS.map((h) => ({
                field: 'hat',
                value: h.id,
                label: h.label,
                preview: { hat: h.id },
                locked: lock(h.id),
              })),
            ],
          },
        ];
      case 'face':
        return [
          {
            title: 'Face',
            options: [
              { field: 'faceAcc', value: '', label: 'None', preview: { faceAcc: null } },
              ...FACE_ACCESSORIES.map((a) => ({
                field: 'faceAcc',
                value: a.id,
                label: a.label,
                preview: { faceAcc: a.id },
                locked: lock(a.id),
              })),
            ],
          },
        ];
      case 'outfit':
        return [
          {
            title: 'Outfit',
            options: (Object.keys(OUTFIT_LABELS) as OutfitId[]).map((o) => ({
              field: 'outfit',
              value: o,
              label: OUTFIT_LABELS[o],
              preview: { outfit: o },
              locked: lock(o),
              body: true,
            })),
          },
        ];
      case 'character':
        return [
          {
            title: 'Character',
            options: PRESETS.map((_, i) => ({
              field: 'presetId',
              value: String(i),
              label: `Character ${i + 1}`,
              preview: { presetId: i },
            })),
          },
        ];
    }
  };

  const currentValue = (cfg: AvatarConfig, field: string): string => {
    switch (field) {
      case 'style':
        return cfg.style.style;
      case 'palette':
        return cfg.style.palette;
      case 'outline':
        return String(cfg.style.outline);
      case 'hat':
        return cfg.hat ?? '';
      case 'faceAcc':
        return cfg.faceAcc ?? '';
      case 'outfit':
        return cfg.outfit;
      case 'presetId':
        return String(cfg.presetId);
    }
    return '';
  };

  const draw = () => {
    const cfg = app.avatar!;
    const tabs: [Tab, string][] = [
      ['look', 'Look'],
      ['hat', 'Hat'],
      ['face', 'Face'],
      ['outfit', 'Outfit'],
    ];
    if (cfg.source === 'preset') tabs.push(['character', 'Character']);
    const groups = optionsFor(tab, cfg);
    render(
      root,
      `<div class="panel panel-wide">
        <h2>Photo Booth</h2>
        <div class="editor">
          <div class="stack">
            <div class="stage"><canvas width="1" height="1" aria-label="Your character"></canvas></div>
            <div class="row center">
              <button class="btn" data-action="download">Save picture</button>
              ${canShareFiles() ? '<button class="btn btn-teal" data-action="share">Share</button>' : ''}
            </div>
          </div>
          <div class="stack">
            <div class="tabs" role="tablist" aria-label="What to change">
              ${tabs
                .map(
                  ([t, label]) =>
                    `<button role="tab" class="tab" data-action="tab" data-tab="${t}" aria-selected="${t === tab}">${label}</button>`,
                )
                .join('')}
            </div>
            <div role="tabpanel" class="tabpanel">
              ${groups
                .map(
                  (g) => `<fieldset>
                    <legend>${g.title}</legend>
                    <div class="thumbs">
                      ${g.options
                        .map((o, i) => {
                          const on = currentValue(cfg, o.field) === o.value;
                          return `<button class="thumb${o.body ? ' thumb-body' : ''}" data-action="set" data-field="${o.field}" data-value="${o.value}" data-thumb="${g.title}:${i}"
                            aria-pressed="${on}" ${o.locked ? `disabled aria-describedby="lock-${o.value}"` : ''}>
                            <canvas width="1" height="1" aria-hidden="true"></canvas>
                            <span>${o.locked ? '🔒 ' : ''}${o.label}</span>
                          </button>`;
                        })
                        .join('')}
                    </div>
                    ${g.options
                      .filter((o) => o.locked)
                      .map(
                        (o) =>
                          `<p class="note" id="lock-${o.value}">🔒 ${o.label}: ${escapeHtml(o.locked!)}</p>`,
                      )
                      .join('')}
                  </fieldset>`,
                )
                .join('')}
            </div>
          </div>
        </div>
        <div class="row center" style="margin-top:1rem">
          <button class="btn btn-big" data-action="play">Play</button>
          <button class="btn btn-ghost" data-action="newPhoto">${cfg.source === 'photo' ? 'New photo' : 'Use a photo'}</button>
          <button class="btn btn-ghost" data-action="menu">Menu</button>
        </div>
      </div>`,
    );
    drawThumbs(groups);
    animatePreview();
  };

  /** Draw each option as a little picture of you with that option. */
  const drawThumbs = (groups: { title: string; options: Option[] }[]) => {
    for (const g of groups) {
      g.options.forEach((o, i) => {
        const btn = root.querySelector<HTMLElement>(`[data-thumb="${g.title}:${i}"]`);
        const canvas = btn?.querySelector('canvas');
        if (!canvas) return;
        const cfg = { ...app.avatar!, ...o.preview };
        const img = o.body
          ? renderFrames(app.base!, cfg, 1, ['idle'])[0]
          : renderHead(app.base!, cfg, 1);
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
      });
    }
  };

  /** The big preview runs in place (or stands still with reduced motion). */
  const animatePreview = () => {
    window.clearInterval(animTimer);
    const canvas = root.querySelector<HTMLCanvasElement>('.stage canvas')!;
    const reduced = getSettings().reducedMotion;
    const frames = renderFrames(app.base!, app.avatar!, 4, reduced ? ['idle'] : RUN_FRAMES);
    canvas.width = frames[0].width;
    canvas.height = frames[0].height;
    const ctx = canvas.getContext('2d')!;
    let i = 0;
    const show = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frames[i % frames.length], 0, 0);
      i++;
    };
    show();
    if (!reduced) animTimer = window.setInterval(show, 90);
  };

  const set = async (field: string, value: string) => {
    const cfg: AvatarConfig = { ...app.avatar!, style: { ...app.avatar!.style } };
    switch (field) {
      case 'style':
        cfg.style.style = value as FaceStyle;
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
    draw();
    root.querySelector<HTMLElement>(`[data-field="${field}"][data-value="${value}"]`)?.focus();
  };

  onActions(root, {
    tab: (el) => {
      tab = el.dataset.tab as Tab;
      draw();
      root.querySelector<HTMLElement>(`[data-tab="${tab}"]`)?.focus();
    },
    set: (el) => void set(el.dataset.field!, el.dataset.value!),
    download: () => void downloadCard(makeCard(app.base!, app.avatar!)),
    share: () => void shareCard(makeCard(app.base!, app.avatar!), 'Me, pixelated!'),
    play: () => void app.play(),
    newPhoto: () => app.go('photo'),
    menu: () => app.go('menu'),
  });

  draw();
  return () => window.clearInterval(animTimer);
};
