# Dev journal

Newest first. What changed, why, and what broke.

## 2026-11-01 – v0.2 phase 1: likeness + head cut-out

**Changed**

- Face Detector → **Face Landmarker** (478 points) + **selfie Image Segmenter**, both self-hosted.
- Head cut-out: person mask, minus everything below the jawline and beside it (no neck, shoulders or background). Toggle in the crop screen.
- Crop now fits the visible head, so the face fills the square.
- New pixel filter: colours picked from the photo (k-means in Lab), stray-pixel cleanup, and a **feature boost** that redraws pupils, brows, mouth and nose at small sizes.
- Pixel sizes: Retro 16 / Classic 24 / Fine 48 (Chunky removed). Default: Fine, Natural colours.
- Hats and glasses now fit each head (placed from the saved eye/head positions).
- Live "In the game" preview in the crop screen.
- `scripts/likeness-gallery.mjs`: screenshots every look for a folder of test photos.

**Why**

- Owner feedback: only Fine looked like them; the neck and wall showed inside a circle.

## 2026-10-26 – v0.1.0, first playable

**Built**

- Vite + TypeScript + Phaser 4 project, ESLint, Prettier, Vitest, Playwright.
- Photo pipeline: upload / camera / ready-made characters → MediaPipe face detection (self-hosted) → level crop with manual adjust → on-device pixel filter → IndexedDB.
- Photo Booth: look, pixel size, palettes, outline, 5 hats, 4 face accessories, 5 outfits, unlocks, save/share picture.
- Zone Run: 4 zones, robot chase, 3 power-ups, tutorial, double jump, short hop, slide, fast fall.
- HTML landing page with SEO tags, JSON-LD, how to play, privacy section.
- PWA (installable, offline), strict CSP, debug overlay, reduced-motion + slow mode.
- All art and sound generated in code. Icons/OG image from `scripts/make-icons.mjs`.

**Decisions**

- No AI image generation: on-device filter is free, instant and private.
- HTML for menus, canvas only for gameplay (accessibility + SEO).
- TypeScript 6.0 instead of 7.0, because typescript-eslint does not support 7 yet.
- Playwright pinned to 1.63 to reuse an already-installed Chromium build.

**Bugs found and fixed**

- Click handlers piled up when switching screens → each screen now gets a fresh element.
- Icon generator wrote colour bytes at fractional offsets → coordinates are now rounded.
- Tutorial hint covered the first obstacle → moved up.
- Crop screen shade darkened the whole panel → clipped to the crop box.
- MediaPipe logs `INFO:` lines as console errors → ignored in e2e tests.
