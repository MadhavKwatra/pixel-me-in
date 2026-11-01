/**
 * Getting a face: camera, upload, or a ready-made character.
 * Everything here runs in the browser. See docs/PRIVACY.md for the full flow.
 */
import { sfx } from '../../audio/sfx';
import { FACE_SIZE } from '../../config';
import { canvasToBlob, canvasToPixels } from '../../face/canvas';
import { detectFaces, loadDetector } from '../../face/detectFace';
import {
  DEFAULT_AVATAR,
  deleteBaseFace,
  saveAvatar,
  saveBaseFace,
  type AvatarConfig,
} from '../../face/faceStore';
import { cutOutHead, type HeadCutout } from '../../face/cutout';
import {
  cropFromDetection,
  cropFromHeadBox,
  defaultCrop,
  defaultMeta,
  eyeAngle,
  metaFromLandmarks,
  pickMainFace,
  type CropTransform,
  type FaceDetection,
} from '../../face/geometry';
import { drawCrop } from '../../face/normalizeFace';
import { drawPreset, presetMeta, PRESETS } from '../../face/presets';
import { renderHead } from '../../face/renderAvatar';
import { fileToCanvas, videoToCanvas } from '../../face/source';
import type { Screen } from '../app';
import { hasCamera, isTouch } from '../device';
import { escapeHtml, flash, onActions, render } from '../dom';
import { showLoader } from '../loader';

const PRIVACY_NOTE =
  '<p class="note">🔒 Your photo stays on this device. Nothing is uploaded. Only a small face crop is saved, and you can delete it any time in Settings.</p>';

export const photoScreen: Screen = (app, root) => {
  let stream: MediaStream | null = null;
  let source: HTMLCanvasElement | null = null;
  let disposed = false;

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };

  const base = (): AvatarConfig => ({ ...(app.avatar ?? DEFAULT_AVATAR) });

  // ---------------------------------------------------------- 1. choose

  function choose(error = '') {
    stopCamera();
    render(
      root,
      `<div class="panel">
        <h2>Get into the game</h2>
        <p>${app.avatar ? 'Pick a new face.' : 'First, make your character.'} Use a clear, front-facing photo.</p>
        ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
        <div class="stack">
          ${hasCamera() ? '<button class="btn btn-big" data-action="camera" autofocus>📸 Take a photo</button>' : ''}
          <label class="btn btn-teal center" tabindex="0">
            Upload a photo
            <input type="file" accept="image/*" hidden />
          </label>
          ${isTouch() ? '' : '<div class="dropzone">…or drop a photo here</div>'}
          <button class="btn btn-ghost" data-action="presets">No photo – pick a character</button>
          ${app.avatar ? '<button class="btn btn-ghost" data-action="back">Back</button>' : '<button class="btn btn-ghost" data-action="exit">Exit</button>'}
        </div>
        ${PRIVACY_NOTE}
      </div>`,
    );
    const input = root.querySelector<HTMLInputElement>('input[type=file]')!;
    const label = input.closest('label')!;
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener('change', () => input.files?.[0] && void useFile(input.files[0]));

    const drop = root.querySelector<HTMLElement>('.dropzone');
    if (drop) {
      const panel = root.querySelector<HTMLElement>('.panel')!;
      panel.addEventListener('dragover', (e) => {
        e.preventDefault();
        drop.classList.add('over');
      });
      panel.addEventListener('dragleave', () => drop.classList.remove('over'));
      panel.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.classList.remove('over');
        const f = e.dataTransfer?.files?.[0];
        if (f) void useFile(f);
      });
    }
    // Start downloading the face finder now, while the player picks a photo.
    void loadDetector().catch(() => {});
  }

  async function useFile(file: File) {
    try {
      source = await fileToCanvas(file);
      await crop();
    } catch (e) {
      choose((e as Error).message || 'Could not read that photo.');
    }
  }

  // ---------------------------------------------------------- 2. camera

  async function camera() {
    render(
      root,
      `<div class="panel">
        <h2>Smile!</h2>
        <div class="camera"><video playsinline muted autoplay></video><div class="oval-guide"></div></div>
        <p class="note">Put your face in the oval. Good light helps.</p>
        <div class="row center">
          <button class="btn btn-big" data-action="snap" disabled>Snap!</button>
          <button class="btn btn-ghost" data-action="cancel">Cancel</button>
        </div>
      </div>`,
    );
    const video = root.querySelector('video')!;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      if (disposed) return stopCamera();
      video.srcObject = stream;
      await video.play();
      root.querySelector<HTMLButtonElement>('[data-action=snap]')!.disabled = false;
    } catch (e) {
      const name = (e as Error).name;
      choose(
        name === 'NotAllowedError'
          ? 'Camera permission was denied. You can upload a photo instead.'
          : 'Could not start the camera. You can upload a photo instead.',
      );
    }
  }

  function snap() {
    const video = root.querySelector('video');
    if (!video || !video.videoWidth) return;
    sfx.shutter();
    flash();
    source = videoToCanvas(video);
    stopCamera();
    void crop();
  }

  // ---------------------------------------------------------- 3. find face + adjust

  async function crop() {
    if (!source) return;
    render(
      root,
      `<div class="panel"><h2>Finding your face…</h2><div data-loader></div><p class="note">The first time, the face finder downloads (about 17 MB). After that it works offline.</p></div>`,
    );
    const loader = showLoader(
      root.querySelector<HTMLElement>('[data-loader]')!,
      'Scanning for eyes, mouth and hair…',
    );

    let t: CropTransform;
    let message: string;
    let debugInfo = '';
    let face: FaceDetection | undefined;
    let cutout: HeadCutout | null = null;
    try {
      const faces = await detectFaces(source);
      face = pickMainFace(faces);
      if (face) {
        cutout = await cutOutHead(source, face).catch(() => null);
        t = cutout ? cropFromHeadBox(cutout.bbox, eyeAngle(face)) : cropFromDetection(face);
        message =
          faces.length > 1
            ? 'Found more than one face – we picked the biggest. Adjust if needed.'
            : 'Face found! Adjust if needed.';
        debugInfo = `faces: ${faces.length}, landmarks: ${face.landmarks?.length ?? 0}, cut-out: ${cutout ? 'yes' : 'no'}`;
      } else {
        t = defaultCrop(source.width, source.height);
        message = 'We could not find a face. Drag and zoom to place it in the circle.';
      }
    } catch {
      t = defaultCrop(source.width, source.height);
      message =
        'The face finder could not load (are you offline?). Place your face in the circle by hand.';
    }
    loader.close();
    if (disposed) return;

    let useCut = !!cutout;
    const baseSide = t.side;
    const baseAngle = t.angle;
    render(
      root,
      `<div class="panel">
        <h2>Line it up</h2>
        <p aria-live="polite">${message}</p>
        <div class="crop-row">
          <div class="crop-box" aria-label="Face crop. Drag to move."><canvas width="${FACE_SIZE}" height="${FACE_SIZE}"></canvas></div>
          <figure class="crop-preview"><canvas width="1" height="1" aria-label="How you will look in the game"></canvas><figcaption>In the game</figcaption></figure>
        </div>
        <div class="stack" style="margin-top:0.75rem">
          ${cutout ? '<label class="toggle"><span>Remove background</span><input type="checkbox" data-cut checked /></label>' : ''}
          <label class="slider">Zoom <input type="range" min="50" max="250" value="100" data-zoom /></label>
          <label class="slider">Tilt <input type="range" min="-45" max="45" value="0" data-tilt /></label>
          ${app.debug && debugInfo ? `<p class="note">debug – ${debugInfo}</p>` : ''}
          <div class="row center">
            <button class="btn btn-big" data-action="use">Use this</button>
            <button class="btn btn-ghost" data-action="retry">Another photo</button>
          </div>
        </div>
        ${PRIVACY_NOTE}
      </div>`,
    );

    const box = root.querySelector<HTMLElement>('.crop-box')!;
    const out = box.querySelector('canvas')!;
    const preview = root.querySelector<HTMLCanvasElement>('.crop-preview canvas')!;
    const zoom = root.querySelector<HTMLInputElement>('[data-zoom]')!;
    const tilt = root.querySelector<HTMLInputElement>('[data-tilt]')!;
    const workSource = () => (useCut && cutout ? cutout.canvas : source!);
    const currentMeta = () =>
      face?.landmarks
        ? metaFromLandmarks(face.landmarks, t, useCut && cutout ? cutout.bbox : null)
        : defaultMeta();

    let queued = false;
    const draw = () => {
      if (queued) return;
      queued = true;
      box.classList.toggle('cutout', useCut);
      requestAnimationFrame(() => {
        queued = false;
        if (!source) return;
        const c = drawCrop(workSource(), t);
        const ctx = out.getContext('2d')!;
        ctx.clearRect(0, 0, FACE_SIZE, FACE_SIZE);
        ctx.drawImage(c, 0, 0);
      });
    };
    // The game preview runs the full pixel filter, so only update it when the player pauses.
    let previewTimer = 0;
    const drawPreview = () => {
      window.clearTimeout(previewTimer);
      previewTimer = window.setTimeout(() => {
        if (!source) return;
        const head = renderHead(
          { pixels: canvasToPixels(drawCrop(workSource(), t)), meta: currentMeta() },
          { ...(app.avatar ?? DEFAULT_AVATAR), hat: null, faceAcc: null },
          2,
        );
        preview.width = head.width;
        preview.height = head.height;
        preview.getContext('2d')!.drawImage(head, 0, 0);
      }, 150);
    };
    const redraw = () => {
      draw();
      drawPreview();
    };
    redraw();

    root.querySelector<HTMLInputElement>('[data-cut]')?.addEventListener('change', (e) => {
      useCut = (e.target as HTMLInputElement).checked;
      redraw();
    });
    zoom.addEventListener('input', () => {
      t.side = (baseSide * 100) / Number(zoom.value);
      redraw();
    });
    tilt.addEventListener('input', () => {
      t.angle = baseAngle + (Number(tilt.value) * Math.PI) / 180;
      redraw();
    });
    box.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        zoom.value = String(Number(zoom.value) - Math.sign(e.deltaY) * 8);
        zoom.dispatchEvent(new Event('input'));
      },
      { passive: false },
    );

    // Drag to move: convert screen pixels into source-image pixels.
    let last: { x: number; y: number } | null = null;
    box.addEventListener('pointerdown', (e) => {
      box.setPointerCapture(e.pointerId);
      last = { x: e.clientX, y: e.clientY };
    });
    box.addEventListener('pointermove', (e) => {
      if (!last) return;
      const k = t.side / box.clientWidth;
      const u = (e.clientX - last.x) * k;
      const v = (e.clientY - last.y) * k;
      t.cx -= u * Math.cos(t.angle) - v * Math.sin(t.angle);
      t.cy -= u * Math.sin(t.angle) + v * Math.cos(t.angle);
      last = { x: e.clientX, y: e.clientY };
      draw();
    });
    const end = () => {
      if (last) drawPreview();
      last = null;
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);

    useCrop = async () => {
      if (!source) return;
      const crop = drawCrop(workSource(), t, FACE_SIZE);
      await saveBaseFace(await canvasToBlob(crop), currentMeta());
      // The full photo (and the cut-out copy) are no longer needed: drop them from memory.
      source.width = 0;
      source = null;
      if (cutout) cutout.canvas.width = 0;
      cutout = null;
      const cfg = { ...base(), source: 'photo' as const };
      await saveAvatar(cfg);
      await app.refreshAvatar();
      sfx.power();
      app.go('editor');
    };
  }

  let useCrop: () => Promise<void> = async () => {};

  // ---------------------------------------------------------- presets

  function presets() {
    render(
      root,
      `<div class="panel">
        <h2>Pick a character</h2>
        <div class="preset-grid">
          ${PRESETS.map((_, i) => `<button data-action="preset" data-i="${i}" aria-label="Character ${i + 1}"><canvas></canvas></button>`).join('')}
        </div>
        <div class="row center" style="margin-top:1rem">
          <button class="btn btn-ghost" data-action="retry">Back</button>
        </div>
        <p class="note">You can switch to a photo later in the Photo Booth.</p>
      </div>`,
    );
    root.querySelectorAll<HTMLCanvasElement>('.preset-grid canvas').forEach((c, i) => {
      const head = renderHead(
        { pixels: canvasToPixels(drawPreset(i)), meta: presetMeta() },
        { ...DEFAULT_AVATAR, presetId: i },
        2,
      );
      c.width = head.width;
      c.height = head.height;
      c.getContext('2d')!.drawImage(head, 0, 0);
    });
  }

  async function pickPreset(i: number) {
    await deleteBaseFace();
    await saveAvatar({ ...base(), source: 'preset', presetId: i });
    await app.refreshAvatar();
    app.go('editor');
  }

  onActions(root, {
    camera: () => void camera(),
    snap,
    cancel: () => choose(),
    retry: () => choose(),
    presets,
    preset: (el) => void pickPreset(Number(el.dataset.i)),
    use: () => void useCrop(),
    back: () => app.go('editor'),
    exit: () => history.back(),
  });

  choose();
  return () => {
    disposed = true;
    stopCamera();
    if (source) source.width = 0;
    source = null;
  };
};
