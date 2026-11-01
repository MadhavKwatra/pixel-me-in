# Architecture

## Big picture

```
index.html (landing page, plain HTML – what search engines read)
   │  "Play" (lazy-loads the game code)
   ▼
src/ui/app.ts  ── screens (menu, photo, Photo Booth, settings, …) as HTML over the canvas
   │                │
   │                └─ src/face/*  photo → face crop → pixel head  (all on device)
   ▼
src/game/controller.ts  ── the only bridge to Phaser
   │  game.events (EVENTS in src/game/events.ts): hud, zone, chase, hint, gameover, pause
   ▼
Phaser 4: BootScene (builds textures from code) → RunScene (the runner)
```

- **HTML for UI, canvas for gameplay.** Menus, forms and text are real HTML: accessible, crisp, searchable, easy to change. Only the running game is a `<canvas>`.
- **Lazy loading.** The landing page loads ~20 KB of JS. Phaser (~375 KB gzipped) loads when the player presses Play. MediaPipe (runtime ~13 MB + face models ~4 MB) loads only on the photo screen.

## The photo pipeline (`src/face/`)

| Step | File                                        | What happens                                                                                                                                                  |
| ---- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `source.ts`                                 | File or camera frame → canvas (max 1024 px). EXIF rotation applied, EXIF data dropped.                                                                        |
| 2    | `detectFace.ts`, `cutout.ts`, `headMask.ts` | Face Landmarker (478 points) + selfie Image Segmenter (self-hosted) → head cut-out: person mask, minus everything below the jawline (no neck, no background). |
| 3    | `geometry.ts`                               | Pure math: crop transform so the eyes are level and always at the same spot. Unit-tested.                                                                     |
| 4    | `normalizeFace.ts`                          | Draw the 256×256 normalized crop. The player can drag / zoom / tilt it.                                                                                       |
| 5    | `faceStore.ts`                              | Save the crop (PNG blob) + avatar settings in IndexedDB. Original photo is discarded.                                                                         |
| 6    | `stylize.ts`                                | Pure pixel filter: downsample → auto-level → palette → oval mask → outline → upscale. Unit-tested.                                                            |
| 7    | `renderAvatar.ts`                           | Head (64×64 frame, room for hats) + accessories + body → canvases for the game and Photo Booth.                                                               |

Because every face is normalized to the same anchors (`ANCHORS` in `geometry.ts`), accessories are simple pixel drawings at fixed positions (`accessories.ts`) and fit everyone.

## The game (`src/game/`)

- **Virtual resolution** 640×360, `pixelArt: true`, `Scale.FIT`. Ground at y = 300.
- **RunScene**: world speed comes from `rules.speedAt(distance)`. Obstacles, gears and power-ups live in pooled Arcade groups and move left at the world speed. Parallax: 3 TileSprite layers.
- **Spawning**: `rules.pickPattern` (weighted, seeded RNG) + `rules.nextGapPx` (time-based, never < 0.8 s, unit-tested for fairness).
- **Zones**: every 500 m (`ZONE_LENGTH_M`). The last 90 m of each zone is a robot chase (more obstacles). Zone art is in `src/art/world.ts`.
- **Player**: an invisible physics box (different hitbox for standing / sliding) with a body sprite and the face head following it.
- **Tutorial**: the first run uses fixed patterns; hitting a tutorial obstacle shows "try again" instead of game over.

## Storage

| What                                     | Where                          | Key                         |
| ---------------------------------------- | ------------------------------ | --------------------------- |
| Face crop (256×256 PNG), avatar settings | IndexedDB `pixel-me-in/avatar` | `baseFace`, `avatar`        |
| Settings, stats (best, gears, runs)      | localStorage                   | `pmi:settings`, `pmi:stats` |

"Delete my data" (`clearAllData`) removes all of it.

## PWA

`vite-plugin-pwa` (generateSW). App shell, icons and the face model are precached. The big MediaPipe WASM is cached on first use (CacheFirst). Updates show a "Reload" toast (`src/ui/pwa.ts`).

## Security

Production `index.html` gets a strict CSP (see `vite.config.ts`): `connect-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'`, `object-src 'none'`.

## Testing

- `tests/` – Vitest unit tests for pure modules (geometry, stylize, rules, unlocks).
- `e2e/` – Playwright: landing + CSP, preset → Photo Booth → run, upload → crop, fake camera → crop, phone rotate screen. Every e2e test fails if a request goes to another host.
