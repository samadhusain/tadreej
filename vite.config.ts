import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { audioCachePattern, extraAudioBase } from './src/tadreej/reciters'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  // The path the app is served from: '/' at the root of a domain, or a
  // subpath such as '/tadreej/' when self-hosted under one. vite-plugin-pwa
  // derives the manifest's start_url and scope, and the service worker's
  // fallback, from the base Vite resolves, so a missing slash cannot break them.
  const base = env.VITE_BASE || '/'
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Tadreej',
          short_name: 'Tadreej',
          description: 'Stepped Quran memorisation player',
          display: 'standalone',
          background_color: '#f5f8f5',
          theme_color: '#17834a',
          // Relative to the manifest, so they follow the base path.
          icons: [
            { src: 'icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
            { src: 'icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
            { src: 'icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
            { src: 'icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
            { src: 'icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
            { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
            { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          navigateFallbackDenylist: [/^\/tadreej-audio\//],
          runtimeCaching: [
            {
              // everyayah.com, and the extra reciters' ayah files (same host the app uses)
              urlPattern: audioCachePattern(extraAudioBase(env.VITE_EXTRA_AUDIO_BASE)),
              handler: 'CacheFirst',
              options: {
                cacheName: 'tadreej-audio',
                plugins: [
                  {
                    // Fetch the whole file, without the Range header: Range requests stall audio on iOS.
                    requestWillFetch: async ({ request }: { request: Request }) => {
                      return new Request(request.url, {
                        headers: {},
                        mode: request.mode,
                        credentials: request.credentials,
                      })
                    },
                    cacheKeyWillBeUsed: async ({ request }: { request: Request }) => {
                      return request.url
                    },
                  },
                ],
              },
            },
            {
              urlPattern: /^https:\/\/api\.alquran\.cloud\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'tadreej-text',
                networkTimeoutSeconds: 5,
              },
            },
            {
              // Word-by-word translations and timings. The Quran Foundation
              // developer terms forbid keeping its content longer than a week.
              urlPattern: /^https:\/\/api\.quran\.com\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'tadreej-words',
                networkTimeoutSeconds: 5,
                expiration: { maxAgeSeconds: 7 * 24 * 60 * 60 },
              },
            },
          ],
        },
      }),
    ],
  }
})
