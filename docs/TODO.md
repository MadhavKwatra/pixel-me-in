# Roadmap / TODO

## Now (v0.3 – in progress)

- [x] Phone testing over Wi-Fi: `npm run dev:phone`.
- [x] Pages: phone menu, current page in the nav, footer with icons that stays at the bottom, sticky "Play now" bar on phones.
- [x] Feedback & contact: socials, share the game; `FEEDBACK_URL` and `REPO_URL` in `src/creator.ts`.
- [ ] Create a free feedback form (Tally or Google Forms) and put its link in `FEEDBACK_URL`.
- [x] Touch: tap / swipe gestures, optional control pad, full-screen portrait play.
- [x] Robot: new animation; "Robot Rush" attacks; two designs to compare (stumble + catch-up / attacks only).
- [x] Robot design: Stumble + catch-up (owner's pick); test switch removed.
- [x] Share to socials: story image (9:16), X / Threads / WhatsApp / Facebook / LinkedIn, challenge links.
- [x] Creator character on the landing page (from the owner's photo; owner picked "Pixel · T-shirt").
- [x] Social preview image with the creator character and the RAM theme (`node scripts/og-image.mjs`).
- [x] Promo videos (landscape 16:9 + vertical 9:16): `node scripts/promo-video.mjs` → `promo/videos/`.
- [x] Videos: start in the Photo Booth, game sounds + music, captions in a band above the game, "Would you play this?" end card.
- [x] Touch buttons on/off in the Pause menu and during the tutorial.
- [ ] Owner: post the demo videos and collect answers to "Would you play this?".
- [x] Marketing pack: "everything" post, 5-slide carousel, story, X/LinkedIn image, before/after (`node scripts/promo-images.mjs`) an 18 s Reel (`node scripts/promo-reel.mjs`) and the same in landscape for X / Threads / LinkedIn (`--landscape`); captions + hashtags in `promo/captions.md`. All in `promo/` (git-ignored).
- [ ] Post the launch pack (owner): Reel first, carousel 1–2 days later, story with the link sticker.

## Save Your RAM – release 2

- [ ] Zone "Neon City": flying cars (slide), delivery drones, billboards "Upgrade to Cloud RAM™".
- [ ] Zone "The Cloud": run on clouds, floating server racks, RAM worth more.
- [ ] "Classic" mode switch (backyard → space zones are kept in `CLASSIC_ZONES`).
- [ ] Optional: put any face on the villain (local only, like the player's face).
- [ ] Music: a "techier" lead for the desk and data-center songs.

## Before launch

- [x] **Domain**: https://play.madhavkwatra.in (Vercel, DNS at Netlify DNS), live 2026-11-04.
- [x] **Deploy**: Vercel, auto-deploys from GitHub `main` (`vercel.json`).
- [x] **Repo** is public: https://github.com/MadhavKwatra/pixel-me-in (owner, 2026-11-04). Links on About, Privacy, footer, Settings.
- [x] Repo homepage link + description set (play.madhavkwatra.in).
- [x] GitHub social preview image uploaded (owner, 2026-11-04).
- [ ] README GIF of a run.
- [x] **SEO + link previews**: canonical, absolute `og:url`/`og:image`, `sitemap.xml`, `robots.txt` for https://play.madhavkwatra.in (owner, 2026-11-04).
- [x] Google Search Console: Domain property `madhavkwatra.in` verified by DNS TXT (Netlify DNS); sitemap submitted (owner, 2026-11-04).
- [x] Bing Webmaster Tools: imported from Google Search Console (it imported `https://madhavkwatra.in/`).
- [ ] Owner: in Bing, make sure `https://play.madhavkwatra.in/sitemap.xml` is submitted (add the `play.` site with a meta tag if Bing refuses).
- [x] WhatsApp link preview works (title, text, picture).
- [ ] Optional: centre the title in `og-image.png` so WhatsApp's square crop shows it (offered to the owner).
- [x] **Analytics**: Vercel Web Analytics (visits) + PostHog US (game steps), cookieless, via our own domain, opt-out in Settings (`src/analytics.ts`, `docs/PRIVACY.md`).
- [x] PostHog (US, personal account): key set in Vercel (`VITE_POSTHOG_KEY`, Production), cookieless server hash mode on. Vercel Web Analytics on – a live test visit returned 200.
- [ ] Owner: check that real phone visits show up in PostHog → Activity and Vercel → Analytics (ad blockers and Brave's GPC switch stats off on purpose).
- [ ] Real-device checks: Android Chrome and iPhone Safari (camera, gestures, install, offline).
- [ ] Lighthouse: performance, accessibility, best practices, SEO.
- [x] Offline Photo Booth: face finder downloads on install (not with data saver on) or from Settings (`src/face/offline.ts`).
- [ ] Warn before the ~17 MB face-finder download on mobile data (first photo in the browser).
- [ ] Bug: white game screen (sound only) in the installed app on the owner's phone – get the phone console log.
- [ ] Try many real selfies (dark room, glasses, beard, headwear, different skin tones) and tune the filter.

## Marketing

- [ ] itch.io page (free HTML hosting + game community).
- [ ] Reddit: r/WebGames, r/IndieDev, r/gamedev "Screenshot Saturday".
- [ ] Show HN (angle: on-device face cut-out, nothing uploaded).
- [ ] Product Hunt launch.
- [ ] Dev-log posts on X / Threads / LinkedIn / Instagram ("how the face cut-out works in the browser").
- [ ] Press-kit page: logo, GIFs, screenshots, short description.
- [ ] Challenge links ("Beat my 1,234 m").
- Selling point: no other free browser pixel runner turns your selfie into the hero fully on your device (similar products: Snapchat's 2016 face-on-elf ski game, iOS apps with 3D avatars, photo-to-pixel apps that upload photos).

## Next (v1.x)

- [ ] Music volume slider (music is on/off for now).
- [ ] More hats and outfits (good first issues).
- [ ] Remappable keys.
- [ ] Gamepad navigation in HTML menus.
- [ ] Export / import save (move your character to another device).
- [ ] Version number + changelog on the About page.
- [ ] Daily Run (same seed for everyone each day; great with challenge links).

## Later (v2)

- [ ] Extract a `Mode` config from RunScene (zones, patterns, rules) so modes can be added without touching the engine.
- [ ] Skate mode (rails, ramps, tricks, combos).
- [ ] Dev mode "Bug Hunt".
- [ ] Friends mode (second face on the robot).
- [ ] Android app wrapper (Capacitor) if the PWA is not enough.

## Known limitations

- The short-range face model works best for selfies (face fills a good part of the photo). Far-away faces in group photos may need the manual crop.
- MediaPipe prints an `INFO:` line on the console error channel when it starts. It is harmless.
- `npm audit` lists moderate warnings in build-only tools (the PWA plugin's dependencies). The shipped game has 0.
