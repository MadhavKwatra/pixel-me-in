/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { icon, type IconName } from './src/ui/icons';

/**
 * Content-Security-Policy, added to the built index.html only (Vite's dev
 * server needs inline scripts and a websocket, so dev stays without it).
 *
 * `connect-src 'self'` is the privacy promise in code: the browser itself
 * refuses any fetch/XHR/WebSocket to another site, so a photo cannot be
 * uploaded anywhere even by mistake. See docs/PRIVACY.md.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

/**
 * `<!-- include:name -->` in any page is replaced by partials/name.html (shared header/footer),
 * then `<!-- icon:name -->` by an inline SVG icon from src/ui/icons.ts.
 */
function partialsPlugin(): Plugin {
  return {
    name: 'html-partials',
    transformIndexHtml(html) {
      return html
        .replace(/<!-- include:([\w-]+) -->/g, (_m, name: string) =>
          readFileSync(resolve(__dirname, 'partials', `${name}.html`), 'utf-8'),
        )
        .replace(/<!-- icon:([\w-]+) -->/g, (_m, name: string) => icon(name as IconName));
    },
  };
}

const PAGES = ['index', 'how-to-play', 'privacy', 'about'];

// `npm run dev:phone` uses mode "phone": HTTPS (self-signed) + listen on the Wi-Fi address,
// so a phone on the same network can test everything, including the camera.
export default defineConfig(({ mode }) => ({
  // Relative base so the build works on GitHub Pages sub-paths and inside an iframe.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: Object.fromEntries(PAGES.map((p) => [p, resolve(__dirname, `${p}.html`)])),
    },
  },
  // Own ports (not Vite's default 5173/4173): a service worker from another
  // local project on the default port would otherwise take over the page.
  server: { port: mode === 'phone' ? 5191 : 5190, strictPort: true },
  preview: { port: 4190, strictPort: true },
  plugins: [
    ...(mode === 'phone' ? [basicSsl()] : []),
    partialsPlugin(),
    cspPlugin(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png', 'og-image.png'],
      manifest: {
        name: 'Pixel Me In: Save Your RAM',
        short_name: 'Pixel Me In',
        description:
          'Put your face in a pixel-art runner and save your RAM from the data center. Your photo never leaves your device.',
        theme_color: '#1b1f3b',
        background_color: '#1b1f3b',
        display: 'fullscreen',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Take over the page on the very first visit, so the face finder used then is
        // already cached for offline play. Updates still wait for the player (prompt).
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,ttf}'],
        // MediaPipe (WASM ~13 MB + face models ~4 MB) is too big to precache on install.
        // It is cached the first time the player opens the photo screen.
        globIgnores: ['mediapipe/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/mediapipe/'),
            handler: 'CacheFirst',
            options: { cacheName: 'mediapipe', expiration: { maxEntries: 12 } },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
