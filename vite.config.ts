import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Shown in Settings so it's easy to confirm which build is deployed.
function appVersion(): string {
  const env = process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA;
  let sha = env?.slice(0, 7);
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
      sha = 'unknown';
    }
  }
  return `${sha} (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`;
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Hafalan — Quran Memorization',
        short_name: 'Hafalan',
        description: 'Keep the ayat you memorized fresh: read, listen and repeat.',
        lang: 'en',
        dir: 'auto',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1f1a',
        theme_color: '#0f1f1a',
        categories: ['education', 'books', 'lifestyle'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/audio\//],
        runtimeCaching: [
          {
            // Quran text + translation list. App also keeps its own copy in IndexedDB.
            urlPattern: /^https:\/\/api\.alquran\.cloud\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'quran-api',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // Mirrors the Cloudflare Worker route in dev.
      '/audio': {
        target: 'https://everyayah.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/audio/, '/data'),
      },
    },
  },
});
