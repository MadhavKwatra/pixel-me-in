# Roadmap / TODO

## Now (v0.3 – in progress)

- [x] Phone testing over Wi-Fi: `npm run dev:phone`.
- [x] Pages: phone menu, current page in the nav, footer with icons that stays at the bottom, sticky "Play now" bar on phones.
- [x] Feedback & contact: socials, share the game; `FEEDBACK_URL` and `REPO_URL` in `src/creator.ts`.
- [ ] Create a free feedback form (Tally or Google Forms) and put its link in `FEEDBACK_URL`.
- [x] Touch: tap / swipe gestures, optional control pad, full-screen portrait play.
- [x] Robot: new animation; "Robot Rush" attacks; two designs to compare (stumble + catch-up / attacks only).
- [ ] Owner: play both robot designs and pick one (Settings → Robot (test)); then remove the switch.
- [x] Share to socials: story image (9:16), X / Threads / WhatsApp / Facebook / LinkedIn, challenge links.
- [x] Creator character on the landing page (from the owner's photo; owner picked "Pixel · T-shirt").
- [ ] Use the creator character in the social preview image (`og-image.png`) once the domain is set.
- [ ] Promo videos (landscape 16:9 + vertical 9:16).

## Before launch

- [ ] **Domain**: start with `play.madhavkwatra.in`; later maybe the game name (`pixelmein.madhavkwatra.in`, or its own domain – check if `pixelme.in` is free). Separate deploy + one CNAME; link from the portfolio. Saved characters and scores are tied to the web address – moving later resets players' saves, so pick the final address before sharing widely (redirect the old one).
- [ ] **Deploy** (Vercel or Netlify work with a private repo; GitHub Pages on a free account needs a public repo).
- [ ] **Repo**: private until launch, then public (README GIF, topics, social preview image, live link).
- [ ] **SEO + link previews** (once the domain exists): absolute `og:image` and `og:url`, canonical on every page, per-page preview images (1200×630 with the creator character), `sitemap.xml`, Google Search Console + Bing Webmaster Tools, test previews (opengraph.xyz, LinkedIn Post Inspector, WhatsApp).
- [ ] **Analytics** – pick one (all need a CSP `connect-src` allow-list for that domain, a Privacy page update and an e2e allow-list; never any image or face data):
  - PostHog – events, funnels, retention; turn off session replay and autocapture, cookieless mode, EU hosting. Most insight.
  - Google Analytics 4 – free and powerful, but cookies (consent banner), heavy, clashes with "privacy first".
  - Cloudflare Web Analytics – free, cookieless, page views only. Simplest.
  - Vercel Analytics – cookieless, easy on Vercel; custom events on paid plans.
  - GoatCounter – free, open source, cookieless, simple events.
  - Events worth counting: page view, play started, photo vs ready-made, run finished (+ distance bucket), share clicked.
- [ ] Real-device checks: Android Chrome and iPhone Safari (camera, gestures, install, offline).
- [ ] Lighthouse: performance, accessibility, best practices, SEO.
- [ ] Warn before the ~17 MB face-finder download on mobile data.
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
