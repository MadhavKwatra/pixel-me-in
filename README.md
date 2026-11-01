# Pixel Me In

**Put your face in a 2D pixel-art runner game.** Take a selfie (or upload a photo), watch it turn into pixels, then run, jump and slide through a backyard, a rollercoaster, a beach and outer space – with a giant robot chasing you.

🔒 **Your photo never leaves your device.** Face detection runs in your browser. There is no server and no upload. [How we make sure of that →](docs/PRIVACY.md)

![Pixel Me In](public/og-image.png)

## Features

- 📸 **Camera or upload** – or skip the photo and pick a ready-made character
- 🧑‍🎨 **On-device pixel filter** – pixel size, colour palettes, outline, or keep the photo look
- 🎩 **Photo Booth** – hats, masks, glasses, outfits; save or share a picture of your character
- 🏃 **Zone Run** – endless runner, a new world every 500 m, robot chase before each zap
- ⚡ **Power-ups** – shield, gear magnet, jetpack
- 📱 **Works everywhere** – keyboard, touch and gamepad; installable app (PWA) that plays offline
- ♿ **Accessible** – reduce-motion and slow-mode options, screen-reader announcements, keyboard menus
- 🛠️ **Debug view** – add `?debug` to the URL (or enter the Konami code on the menu) to see hitboxes and FPS

## Run it locally

Needs Node.js 20+.

```bash
npm install        # also copies the MediaPipe runtime into public/mediapipe/wasm
npm run dev        # http://localhost:5190
```

| Command           | What it does                                      |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | Dev server with hot reload                        |
| `npm run build`   | Type-check + production build into `dist/`        |
| `npm run preview` | Serve the production build                        |
| `npm test`        | Unit tests (Vitest)                               |
| `npm run e2e`     | Browser smoke tests (Playwright, desktop + phone) |
| `npm run lint`    | ESLint                                            |
| `npm run icons`   | Re-draw icons and the social preview image        |

Dev review tools (need `npm run dev` running; output in `test-results/`): `node scripts/play-check.mjs`, `node scripts/ui-check.mjs`, `node scripts/preview-sprites.mjs`, `node scripts/likeness-gallery.mjs <photo-folder>`.

The camera needs HTTPS or `localhost`.

## Tech

[Phaser 4](https://phaser.io) (game engine) · TypeScript · [Vite](https://vite.dev) · [MediaPipe Face Landmarker + Image Segmenter](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) (self-hosted) · [idb-keyval](https://github.com/jakearchibald/idb-keyval) · [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)

All art and sounds are drawn/synthesized in code – no asset files to download.

## Docs

- [Architecture](docs/ARCHITECTURE.md) – how the pieces fit together
- [Privacy](docs/PRIVACY.md) – the photo pipeline, step by step, with links to the code
- [Game design](docs/GAME_DESIGN.md) – modes, zones, controls, balance
- [Roadmap / TODO](docs/TODO.md)
- [Dev journal](docs/JOURNAL.md)
- [Contributing](CONTRIBUTING.md)

## About

A fan-made, open-source game inspired by the _Phineas and Ferb_ episode "Gaming the System" (season 2, 2009), where the boys build a video game and zap themselves into it. Not affiliated with or endorsed by Disney. No characters, names or art from the show are used.

## Author

Made by **Madhav Kwatra** – [portfolio](https://madhavkwatra.in) · [GitHub](https://github.com/MadhavKwatra) · [LinkedIn](https://www.linkedin.com/in/madhav-kwatra/) · [X](https://x.com/madhav_kwatra)

## License

Code: [MIT](LICENSE). Third-party credits: [CREDITS.md](CREDITS.md).
