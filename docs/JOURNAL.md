# Dev journal

Newest first. What changed, why, and what broke.

## 2026-11-02 – v0.3 part F: share to socials

- Share sheet (`src/ui/shareSheet.ts`) on game over ("Challenge friends") and in the Photo Booth: phone share menu with the picture (Instagram, WhatsApp, Snapchat …), X, Threads, WhatsApp, Facebook, LinkedIn, Copy link, and "Save the picture" in story (1080×1920) or square size.
- Share cards (`src/ui/shareCard.ts`) use the pixel font, show the score + "Can you beat me?" and the game link.
- Challenge links: `?beat=1234` → landing shows "Your friend ran 1,234 m. Can you beat it?"; game over compares your run with your friend's.
- Only links – the game sends nothing. `scripts/share-check.mjs` screenshots the sheet and saves both cards.

## 2026-11-02 – v0.3 part C: the robot

- New robot sprite (`src/art/robot.ts`, shared helpers in `src/art/pixelGrid.ts`): 8-frame stomp, swinging arms, shoulder pads, scanning eye, blinking antenna, pulsing chest light, hazard stripe; laser, throw and zapped poses.
- Robot Rush (last 90 m of each zone): warned attacks instead of normal obstacles – laser (0.8 s blinking warning, slide under) and bomb (red ring where it lands, jump over). The robot is zapped away at the zone change.
- Two designs to compare (Settings → Robot (test)): **Stumble** (default: first crash trips you, the robot runs up behind you for 6 s, a second crash = caught) and **Attacks only** (one crash ends the run). Rules in `rules.ts`, unit-tested.
- Debug shortcut: `?debug&start=395` starts a run just before the first Robot Rush. `scripts/robot-check.mjs` screenshots it.

## 2026-11-02 – v0.3 part B: touch controls, full-screen portrait

- Gestures (`src/ui/gestures.ts`, unit-tested): tap anywhere or swipe up = jump, swipe down (hold) = slide / fast fall. One hand is enough.
- Optional Jump/Slide pad (`src/ui/touchControls.ts`); Settings → Touch buttons: Upright only (default) / Always / Never. Tutorial hints adapt and make the right button glow.
- The canvas now fills the whole screen at device pixel density; `src/game/view.ts` picks the camera: landscape shows more road on wide phones, portrait shows ~420 world px across with sky above and dirt below (ground ~64 % down). Portrait runs 10 % slower for reaction time.
- "Rotate your phone" block removed (no orientation lock); one tip on the first upright run.
- Photo Booth on phones: sticky small preview, one-row tabs, 3 thumbnails per row, sticky action bar.

## 2026-11-02 – v0.3 part A: pages, footer, feedback

- Phone header: Play button + ☰ menu (Esc / outside click closes); current page highlighted.
- Footer: "Made with ♥ by Madhav", icon links (Simple Icons, CC0), Feedback / Privacy; stays at the bottom of short pages.
- Landing on phones: title → tablet → Play order; sticky "Play now" bar once the hero button scrolls away.
- Title screen: link row removed, ✕ exit icon; Settings gets "More" (pages) and "Feedback & contact".
- Feedback & contact block (`src/ui/feedback.ts`): message me (LinkedIn, X, Instagram, portfolio), share the game; feedback form and GitHub links appear once `FEEDBACK_URL` / `REPO_URL` are set in `src/creator.ts`.
- Game over: "Enjoying it? Share the game" from the 3rd run.
- Toasts: close button, always auto-hide.
- `scripts/ui-check.mjs`: every page and screen at 360×740, 390×844, 412×915, 915×412 and 1280×800; warns about sideways overflow.
- Phone testing: `npm run dev:phone` (HTTPS on the Wi-Fi address, port 5191).

## 2026-11-01 – Phaser skills for AI helpers

- Copied Phaser's official agent skills (28 guides shipped in the phaser npm package, MIT) into `.claude/skills/phaser-*` with `npm run skills:phaser`. Prefixed with `phaser-` so generic names like "scenes" do not clash.
- Searched for other game skills: no official Anthropic game skill; community options (e.g. gamedev-skills/awesome-gamedev-agent-skills: game-feel, audio-design) noted but not added.

## 2026-11-01 – v0.2 phase 4: UX/UI

- Short landing page: hero with a "tablet" showing a live mini scene, one Play button, 3 steps, 3 cards.
- Own pages: `how-to-play.html` (device-first controls), `privacy.html`, `about.html` (creator + credits). Shared header/footer from `partials/` via a tiny Vite plugin. Multi-page build; CSP on every page.
- Pixel font Pixelify Sans (OFL, self-hosted) for headings, buttons and HUD; readable system font for body text; sentence-case buttons.
- Title-screen menu with your character running; stats; links to Privacy/About.
- Photo Booth: tabs (Look, Hat, Face, Outfit, Character) with picture buttons, animated preview.
- Themed loading screens (running character + "digitizing" bar) when the game opens and while finding the face.
- Phones only see touch controls (in-game How to play, hints, game-over tip).
- Fixed: Photo Booth overflowed on phones; mini scene crashed when the first animation frame arrived "in the past".

## 2026-11-01 – v0.2 phases 2 + 3: game feel, tutorial, power-ups

**Game feel (phase 2)**

- New body drawn from a tiny skeleton (`src/art/body.ts`): 8-frame run, idle, jump, fall, land, slide, hurt; outlined and shaded; 5 outfits.
- Mario-style controls: jump buffer (130 ms), coyote time (90 ms), faster falling, floaty apex while jump is held, short hop.
- Juice: squash/stretch on the head, run dust, landing puffs, slide sparks, shadow, "+1" pops, speed lines, bobbing/wobbling obstacles, clouds, robot stomp dust.
- Crash: short hit-stop, then the character breaks into its own pixels ("de-digitize").
- "Ready… GO!" start. Chiptune music per zone (`src/audio/music.ts`), Music toggle in Settings.
- Pause button is bigger and shows "Esc" on keyboards.

**Teaching + balance (phase 3)**

- Interactive tutorial: jump → slide → double jump → grab a power-up. Time slows to 25 % near each lesson until the player does the move; touch screens glow on the side to tap, keyboards show the key.
- Power-ups: first one at 120 m, then at least one every 250 m (10 % chance per pattern in between). Unit-tested.

**Dev tools**

- `scripts/preview-sprites.mjs`, `scripts/play-check.mjs`, `scripts/contact-sheet.mjs`.

## 2026-11-01 – v0.2 phase 1b: fewer, better looks

- Owner test: only Fine (48 px) looked like them. Faces at 16–24 px lose identity, so the size picker is gone.
- Looks: **Pixel** (48 px), **Cartoon** (new: smoothed, 9 flat colours, ink lines, feature boost), **Photo**.
- Pause: could not reproduce "no pause screen" (button, Esc and P all work); added an e2e test. The VS Code browser may keep Esc for itself.

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
