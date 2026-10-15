import { APP_VERSION } from './version';
import { getPlayerState, subscribePlayer } from './player';
import { getState } from './store';

// Anonymous usage analytics, sent to our own Worker (/api/e) — no third parties.
// What's sent: a random device id, a session id, event names with small
// non-identifying props (e.g. which page, how many seconds listened), plus app
// version, UI language and whether the app is installed. Never the hafalan
// list, notes, or anything typed. Turn off in Settings.

type Props = Record<string, string | number | boolean>;
interface Ev {
  n: string;
  t: number;
  v?: number;
  p?: Props;
}

const ENDPOINT = '/api/e';
const SESSION_IDLE = 30 * 60_000;
const queue: Ev[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

const rid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).toLowerCase();

function deviceId(): string {
  let id = ls.get('qm-device');
  if (!id) {
    id = rid();
    ls.set('qm-device', id);
  }
  return id;
}

let session = { id: '', last: 0 };
function sessionId(): { id: string; isNew: boolean } {
  const now = Date.now();
  if (!session.id) {
    const saved = ls.get('qm-session');
    if (saved) {
      const [id, last] = saved.split('|');
      session = { id, last: Number(last) || 0 };
    }
  }
  const isNew = !session.id || now - session.last > SESSION_IDLE;
  if (isNew) session.id = rid();
  session.last = now;
  ls.set('qm-session', `${session.id}|${now}`);
  return { id: session.id, isNew };
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function enabled(): boolean {
  if (!import.meta.env.PROD) return false; // no tracking in dev
  if (!getState().settings.analytics) return false;
  if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return false; // automation/bots
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return false;
  return true;
}

/** Mark this browser as the owner's, so the dashboard can exclude it. */
export const isInternal = () => ls.get('qm-internal') === '1';

export function track(name: string, props?: Props, value?: number) {
  if (!enabled()) return;
  const { isNew } = sessionId();
  if (isNew && name !== 'open') queue.push(openEvent());
  queue.push({ n: name, t: Date.now(), ...(value != null ? { v: value } : {}), ...(props ? { p: props } : {}) });
  if (queue.length >= 20) flush();
  else scheduleFlush();
}

function openEvent(): Ev {
  const s = getState();
  return {
    n: 'open',
    t: Date.now(),
    p: {
      reciter: s.settings.reciter,
      tr: s.settings.translations.length,
      passages: s.passages.length,
    },
  };
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, 15_000);
}

export function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  addListening(); // include listening time so far
  if (!queue.length || !enabled()) {
    queue.length = 0;
    return;
  }
  const body = JSON.stringify({
    d: deviceId(),
    s: sessionId().id,
    internal: isInternal() || undefined,
    meta: {
      standalone: isStandalone(),
      ui: getState().settings.uiLang,
      lang: navigator.language,
      v: APP_VERSION.split(' ')[0],
    },
    events: queue.splice(0, queue.length),
  });
  try {
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon?.(ENDPOINT, blob)) {
      void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(
        () => {},
      );
    }
  } catch {
    /* best effort */
  }
}

// ---- listening time ----
let listenMs = 0;
let lastTick = 0;
let lastQueue: unknown = null;
function tickListening() {
  const now = Date.now();
  const st = getPlayerState();
  // A new queue starting to play = one "play" (passage / surah / all / review).
  if (st.queue !== lastQueue && st.queue.length && st.sourceKey) {
    lastQueue = st.queue;
    const k = st.sourceKey;
    track('play', { src: k.startsWith('p:') ? 'passage' : k.startsWith('surah:') ? 'surah' : k });
  }
  if (st.playing && lastTick) listenMs += Math.min(now - lastTick, 5_000);
  lastTick = st.playing ? now : 0;
  if (listenMs >= 60_000) addListening();
}
function addListening() {
  if (listenMs < 1_000) return;
  const seconds = Math.round(listenMs / 1000);
  listenMs = 0;
  if (!enabled()) return;
  sessionId();
  queue.push({ n: 'listen', t: Date.now(), v: seconds });
  scheduleFlush();
}

// ---- page views (normalized, no ids) ----
export function trackPage(route: string) {
  const p = route.startsWith('/p/')
    ? '/p'
    : route.startsWith('/edit/')
      ? '/edit'
      : /^\/quran\/\d+$/.test(route)
        ? '/quran/:surah'
        : route;
  track('page', { p });
}

let started = false;
export function startAnalytics() {
  if (started) return;
  started = true;
  // Owner tooling: open the app once with ?internal=1 (or ?internal=0 to undo).
  const flag = new URLSearchParams(location.search).get('internal');
  if (flag === '1' || flag === '0') ls.set('qm-internal', flag);

  subscribePlayer(tickListening);
  window.addEventListener('appinstalled', () => track('install'));
  window.addEventListener('error', (e) => track('error', { m: String(e.message || e.error).slice(0, 200) }));
  window.addEventListener('unhandledrejection', (e) =>
    track('error', { m: ('Unhandled: ' + String(e.reason?.message ?? e.reason)).slice(0, 200) }),
  );
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}
