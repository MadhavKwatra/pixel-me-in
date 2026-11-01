# Roadmap / TODO

## Now (before first public release)

- [ ] Test on real phones: Android Chrome (install, offline, orientation lock) and iPhone Safari (rotate screen, Add to Home Screen).
- [ ] Try many real selfies (dark room, glasses, beard, hijab/headwear, different skin tones) and tune `ANCHORS`, `autoLevel` and the game palette.
- [ ] Create the public GitHub repo and deploy (GitHub Pages or Vercel).
- [ ] After a domain is known: add `<link rel="canonical">`, absolute `og:image` URL, and `sitemap.xml`.
- [ ] Link from the portfolio (`/?play` opens the game directly).

## Next (v1.x)

- [ ] Background removal for photos (MediaPipe Image Segmenter: keep hair + face only).
- [ ] Background music (chiptune loop) with its own volume setting.
- [ ] A pixel font (OFL licensed, self-hosted).
- [ ] More hats and outfits (good first issues).
- [ ] Remappable keys.
- [ ] Gamepad navigation in HTML menus.

## Later (v2)

- [ ] Extract a `Mode` config from RunScene (zones, patterns, rules) so modes can be added without touching the engine.
- [ ] Skate mode (rails, ramps, tricks, combos).
- [ ] Dev mode "Bug Hunt".
- [ ] Daily Run (date seed).
- [ ] Friends mode (second face on the robot).
- [ ] Android app wrapper (Capacitor) if the PWA is not enough.

## Known limitations

- iPhone Safari cannot lock orientation or go full screen in a normal tab. The game shows a "rotate your phone" screen and suggests installing to the home screen.
- The short-range face model works best for selfies (face fills a good part of the photo). Far-away faces in group photos may need the manual crop.
- MediaPipe prints an `INFO:` line on the console error channel when it starts. It is harmless.
