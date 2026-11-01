# Contributing

Thanks for helping! Small, focused pull requests are easiest to review.

## Setup

```bash
npm install
npm run dev
```

Before opening a PR:

```bash
npm run lint
npm test
npm run build
npm run e2e   # for UI or game changes (first time: npx playwright install chromium)
```

## Rules

1. **The photo never leaves the device.** No new network calls, CDNs, analytics or trackers. If you touch the photo pipeline, update [docs/PRIVACY.md](docs/PRIVACY.md).
2. **Keep it accessible.** Keyboard, touch and gamepad must keep working. Respect the "reduce motion" setting.
3. **Keep logic testable.** Put maths and rules in pure functions and add a unit test in `tests/`.
4. **No copyrighted characters or art** from the show that inspired this game.

## Good first issues

- **New hat or face accessory** – add one entry to `HATS` or `FACE_ACCESSORIES` in [src/face/accessories.ts](src/face/accessories.ts). Coordinates are in the 64×64 head frame; eyes are at about y 32, mouth at y 45.
- **New outfit** – add colours to `OUTFITS` in [src/art/body.ts](src/art/body.ts) and the id to `OutfitId` in `faceStore.ts`.
- **New zone** – add a `ZoneArt` to `ZONES` in [src/art/world.ts](src/art/world.ts).
- **Unlock rule** – add to [src/storage/unlocks.ts](src/storage/unlocks.ts).

Use the debug view (`?debug`) to check hitboxes.

## Pull requests

- One topic per PR. Describe what and why; add a screenshot for visual changes.
- Add a short entry to [docs/JOURNAL.md](docs/JOURNAL.md) for notable changes.
- Be kind. This is a hobby project.
