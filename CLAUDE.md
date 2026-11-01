# CLAUDE.md – notes for AI coding assistants

This is a **public, open-source** repo. Never write private info (emails, account names, local paths, secrets) into files.

## What this is

"Pixel Me In": a 2D pixel-art endless runner (web, PWA). The player's face (photo or camera) becomes the character's head. Plain HTML landing page + full-screen game app.

## Golden rule: the photo never leaves the device

- No server, no uploads, no analytics, no third-party requests. `connect-src 'self'` in the CSP (see `vite.config.ts`) enforces it.
- MediaPipe model + WASM are self-hosted under `public/mediapipe/`. Never load them from a CDN.
- Only the 256×256 normalized face crop is stored (IndexedDB, `src/face/faceStore.ts`). The original photo is dropped after cropping.
- Any change to the photo pipeline must update `docs/PRIVACY.md`. The e2e tests fail on any request to another host.

## Commands

- `npm run dev` · `npm run build` · `npm test` (Vitest) · `npm run e2e` (Playwright) · `npm run lint`
- Run `npm test`, `npm run lint` and `npm run build` before saying a change is done. Run `npm run e2e` for UI/game changes.

## Map

- `src/face/` – photo pipeline: `source` → `detectFace` → `geometry` + `normalizeFace` → `stylize` (pure pixel filter) → `renderAvatar` (+ `accessories`, `presets`), storage in `faceStore`
- `src/game/` – Phaser: `controller.ts` (the only API the UI uses), `scenes/BootScene` (builds textures from code), `scenes/RunScene` (the game), `Player`, `rules.ts` (pure balance logic), `events.ts`
- `src/art/` – all pixel art drawn in code (`body.ts`, `world.ts`)
- `src/ui/` – HTML UI: `app.ts` (shell + play flow), `screens/*`, `hud.ts`, `digitizer.ts`, `shareCard.ts`, `pwa.ts`
- `src/storage/` – settings, stats, unlocks (localStorage, keys prefixed `pmi:`)
- `tests/` unit tests, `e2e/` browser tests, `scripts/` (MediaPipe copy, icon generator)

## Conventions

- TypeScript strict, ES modules, no UI framework. Prettier (single quotes, width 100).
- Keep logic pure where possible (`geometry`, `stylize`, `rules`, `unlocks`) and unit-test it.
- Phaser 4: the v3 API mostly works, but see `node_modules/phaser/skills/v3-to-v4-migration/SKILL.md` (e.g. no `setTintFill`).
- UI text: short, plain English. Templates in `innerHTML` only contain our own text; escape anything else with `escapeHtml`.
- Game name lives in `src/config.ts` (`GAME_NAME`), `index.html` and the PWA manifest in `vite.config.ts`.
- Accessibility: respect `reducedMotion` (no shakes/flashes), keep keyboard + touch + gamepad working.
- Add a dated entry to `docs/JOURNAL.md` for notable changes; keep `docs/TODO.md` current.
