# Hafalan — Quran memorization PWA

A personal, installable, offline-capable web app for keeping the ayat you've memorized fresh.
Save the passages your teacher gives you (e.g. **An-Naml 89–93**), then read them or listen to
them like a playlist, with your headset, whenever they start to fade.

## Features

- **My Hafalan library**: save surah + ayah ranges with a note. Shows when you last listened to each one
  and flags passages you haven't reviewed for a while (default 14 days, configurable).
- **Reader**: Uthmani text (Amiri Quran font) with any number of translations from any language,
  plus transliteration. The playing ayah is highlighted and auto-scrolls.
- **Player** (works with the screen locked; lock-screen and headset buttons via Media Session):
  - repeat each ayah 1×–10×, loop the passage, speed 0.75×–1.5×
  - **pause after ayah** (2s / 5s / "same length as the ayah") so you can recite it back yourself
  - play a single passage, **play all**, or **play review** (only the stale ones)
  - default reciter **Syaikh Yasser Al-Dossari**, plus 11 others
- **Test me** mode: ayat are blurred; tap to peek.
- **Full Quran** tab: read or play any surah, and select a range to add to your hafalan.
- **Offline**: the app shell is precached; text is stored in IndexedDB; audio is stored per ayah in
  Cache Storage, either with "Save offline" or automatically after you've listened once.
- **Device-only storage**, with JSON export/import for backups or moving to a new phone.
- UI in **English** and **Bahasa Indonesia**.

Data sources: text and translations from [api.alquran.cloud](https://alquran.cloud/api); audio from
[everyayah.com](https://everyayah.com), proxied through `/audio/*` by a tiny Cloudflare Worker
(adds CORS + edge caching so audio can be stored offline).

## Develop

```bash
npm install
npm run dev        # http://localhost:5173 (Vite proxies /audio → everyayah.com)
npm run build      # typecheck + production build into dist/
```

## Deploy to Cloudflare

### Option A: Cloudflare Workers (recommended)

`wrangler.jsonc` serves `dist/` as static assets and runs `worker/index.ts` for `/audio/*`.

```bash
npx wrangler login
npm run deploy     # build + wrangler deploy → https://quran-memorize.<you>.workers.dev
```

Or connect the GitHub repo in the Cloudflare dashboard (Workers & Pages → Create → Import a repository)
with build command `npm run build` and deploy command `npx wrangler deploy`.

### Option B: Cloudflare Pages

The `functions/audio/[[path]].ts` Pages Function provides the same audio proxy.

```bash
npm run deploy:pages
```

Or in the dashboard: Pages → Connect to Git → build command `npm run build`, output directory `dist`.

> Hosting somewhere without the `/audio` proxy still works: playback falls back to loading audio
> directly from everyayah.com, but that audio can't be saved for offline use.

## Install on your phone

- **Android (Chrome)**: open the site → "Install app" banner, or menu → *Install app*.
- **iPhone (Safari)**: Share → *Add to Home Screen*.
