import { readFileSync } from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: '/pomotimer2/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    VitePWA({
      // Ask before updating: silently reloading could interrupt a running session.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'pomo · Pomodoro timer',
        short_name: 'pomo',
        description: 'An aesthetic, customizable Pomodoro timer with tasks, streaks and stats.',
        theme_color: '#1c1930',
        background_color: '#1c1930',
        display: 'standalone',
        start_url: '/pomotimer2/',
        scope: '/pomotimer2/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-press / right-click the installed app icon. These use the ?do= link actions.
        shortcuts: [
          { name: 'Start focus', url: '/pomotimer2/?do=start&mode=focus' },
          { name: 'Start short break', url: '/pomotimer2/?do=start&mode=short' },
          { name: 'Start long break', url: '/pomotimer2/?do=start&mode=long' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    // A zone with DST so date logic is tested across clock changes (CI runs in UTC).
    env: { TZ: 'America/New_York' },
    include: ['src/**/*.test.ts'],
  },
});
