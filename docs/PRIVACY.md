# Privacy: how your photo is handled

**Short version:** your photo is processed only in your browser. It is never uploaded. Only a small face crop is saved on your device, and you can delete it.

## Step by step (with the code)

1. **You pick a photo or use the camera.** The browser reads the file locally.
   Code: [`src/face/source.ts`](../src/face/source.ts), camera in [`src/ui/screens/photo.ts`](../src/ui/screens/photo.ts).
   The camera stream is stopped as soon as you snap, cancel or leave the screen.

2. **The photo is redrawn onto a canvas** (max 1024 px). This applies the phone's rotation and **drops all hidden metadata** (EXIF: GPS location, camera model, date).

3. **The face is found and cut out on your device** with MediaPipe Face Landmarker (finds 478 face points: eyes, mouth, jawline) and MediaPipe Image Segmenter (finds which pixels are you, not the background). The background and your neck are removed. The models and the WASM runtime are served from this same website (`public/mediapipe/`), not from Google or a CDN.
   Code: [`src/face/detectFace.ts`](../src/face/detectFace.ts).

4. **A 256×256 crop of your face is made** and you can adjust it.
   Code: [`src/face/geometry.ts`](../src/face/geometry.ts), [`src/face/normalizeFace.ts`](../src/face/normalizeFace.ts).

5. **Only that crop is saved**, in your browser's IndexedDB. The full photo is released from memory.
   Code: [`src/face/faceStore.ts`](../src/face/faceStore.ts).

6. **Pixel art is made from the crop**, on your device, every time it is needed.
   Code: [`src/face/stylize.ts`](../src/face/stylize.ts).

7. **Sharing is your choice.** "Save picture" / "Share" create an image on your device and hand it to your download folder or your phone's share sheet. Nothing is sent by the game itself.

## What is stored

| Data                                                              | Where                         | How to delete             |
| ----------------------------------------------------------------- | ----------------------------- | ------------------------- |
| 256×256 face crop                                                 | IndexedDB (this browser only) | Settings → Delete my data |
| Where your eyes, brows and mouth are in that crop (a few numbers) | IndexedDB                     | Settings → Delete my data |
| Avatar choices (style, hat, outfit)                               | IndexedDB                     | Settings → Delete my data |
| Scores, settings                                                  | localStorage (`pmi:*`)        | Settings → Delete my data |

Picking a ready-made character also deletes a saved face crop. Clearing your browser's site data removes everything too.

## The character on the landing page

The running character in the landing page's tablet is the maker's own pixel character (`public/brand/creator-run.png`), made from his photo with the same on-device pipeline and published with his consent. Only the small pixel-art frames are in the repository – never the photo or the face crop. Players' own characters are never published anywhere.

## How it is enforced

- **No backend.** The site is static files.
- **Content-Security-Policy** in the production build: `connect-src 'self'`. The browser blocks any fetch, XHR or WebSocket to another site. See [`vite.config.ts`](../vite.config.ts).
- **Automated tests** ([`e2e/smoke.spec.ts`](../e2e/smoke.spec.ts)) fail if the page makes any request to another host during the upload and camera flows.
- **No analytics, no ads, no cookies.**

## Check it yourself

1. Open the game, then your browser's developer tools → **Network** tab.
2. Take or upload a photo and play.
3. Every request goes to the same site. No image is sent anywhere.

## Hosting note

The host (e.g. GitHub Pages or Vercel) serves the static files and may keep normal web server logs (IP address, pages requested). It never receives your photo.
