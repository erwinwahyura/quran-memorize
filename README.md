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
- **Offline**: adding a passage automatically downloads its audio and text, so it works without internet
  (toggle in Settings → Offline). Missing downloads are resumed when the app opens or comes back online,
  and after switching reciter. There's also "Download all hafalan", a per-passage "Save offline" button,
  and an *Offline* badge on each card. Deleting a passage frees its audio. The app shell is precached,
  text lives in IndexedDB and audio in Cache Storage.
- **Device-only storage**, with JSON export/import for backups or moving to a new phone.
- UI in **English** and **Bahasa Indonesia**.
- Built-in **How to use** guide (EN/ID), opened from the **?** button on the home screen or from Settings. Edit its content in `src/lib/guide.ts`.

Data sources: text and translations from [api.alquran.cloud](https://alquran.cloud/api); audio from
[everyayah.com](https://everyayah.com), proxied through `/audio/*` by a tiny Cloudflare Worker
(adds CORS + edge caching so audio can be stored offline).

## Usage analytics (private dashboard)

Hafalan has a small, **self-hosted, anonymous** analytics system. No third-party trackers are used. Data goes from the app to your own Worker (`/api/e`) and is stored in a Cloudflare **D1** database in your account.

- **What is collected:** a random device id, session id, page views (without ids), "added a passage", "started playing", listening seconds, Test-me use, installs and error messages. Each device also reports its country/city (from Cloudflare), OS/browser/device type, whether the app is installed, UI language and app version.
- **What is never collected:** IP addresses, the hafalan list, notes or anything typed.
- **Who is not tracked:** users can turn tracking off in **Settings → Privacy**. Browsers sending Global Privacy Control and automated browsers are skipped.
- **Organic numbers:** bots are flagged by User-Agent. Your own devices can be excluded: click **Exclude this device** on the dashboard, or open the app once with `/?internal=1` (undo with `/?internal=0`).

**Setup (once):**

```bash
npm run admin:hash                         # choose a dashboard password → prints a bcrypt hash
npx wrangler secret put ADMIN_PASSWORD_HASH # paste the hash
npm run deploy                             # creates the D1 database automatically on first deploy
```

Then open **https://quran.erwarx.com/admin/** and sign in.

- Tables are created automatically on first use.
- Wrong passwords are rate-limited (5 per 15 minutes per IP).
- Sessions last 7 days. Changing the password signs every session out.
- bcrypt is CPU-heavy: one check takes about 100 ms at cost 10. The Workers **Free** plan allows 10 ms CPU per request, so sign-in may fail there. On the Paid plan it works. Only `/api/login` runs bcrypt; normal app traffic does not.
- If the automatic D1 creation fails, run `npx wrangler d1 create quran-memorize-analytics` and add the printed `database_id` to `wrangler.jsonc`.
- Analytics endpoints run only on the Workers deployment, not on Pages.

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
