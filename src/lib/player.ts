import { useSyncExternalStore } from 'react';
import { resolveAudio, type ResolvedAudio } from './audioCache';
import { reciterName } from './reciters';
import { getState, markPlayed } from './store';
import { getSurah } from './surahs';

// A single <audio> element drives everything, so playback keeps going with the
// screen locked and responds to headset / lock-screen controls (Media Session).

export interface QueueItem {
  surah: number;
  ayah: number;
  passageId?: string;
  /** Last ayah of its passage — finishing it counts as one full listen. */
  last?: boolean;
}

export interface PlayerState {
  queue: QueueItem[];
  index: number;
  /** What's loaded, e.g. "An-Naml 89–93" or "Playlist". */
  title: string;
  /** Identifies the source (passage id, `surah:27`, `all`, …) so pages can highlight. */
  sourceKey: string | null;
  playing: boolean;
  loading: boolean;
  inGap: boolean;
  repeatIteration: number;
  progress: number; // 0..1 within the current ayah
  error: string | null;
}

const initial: PlayerState = {
  queue: [],
  index: 0,
  title: '',
  sourceKey: null,
  playing: false,
  loading: false,
  inGap: false,
  repeatIteration: 0,
  progress: 0,
  error: null,
};

let state: PlayerState = initial;
const listeners = new Set<() => void>();
function setState(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const audio = new Audio();
audio.preload = 'auto';
(audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;

let token = 0; // invalidates stale async loads
let currentAyahSrc: string | null = null;

// ---- blob cache (small LRU so prefetching makes transitions seamless) ----
const LRU_MAX = 10;
const blobCache = new Map<string, Promise<ResolvedAudio>>();
const keyFor = (it: QueueItem, reciter: string) => `${reciter}:${it.surah}:${it.ayah}`;

function getResolved(it: QueueItem): Promise<ResolvedAudio> {
  const { reciter, autoDownload } = getState().settings;
  const k = keyFor(it, reciter);
  let p = blobCache.get(k);
  if (p) {
    blobCache.delete(k);
    blobCache.set(k, p); // refresh LRU position
    return p;
  }
  p = resolveAudio(reciter, it.surah, it.ayah, autoDownload);
  blobCache.set(k, p);
  while (blobCache.size > LRU_MAX) {
    const [oldKey, oldP] = blobCache.entries().next().value as [string, Promise<ResolvedAudio>];
    blobCache.delete(oldKey);
    oldP.then((r) => {
      if (r.src !== currentAyahSrc) r.revoke?.();
    });
  }
  return p;
}

function prefetch(fromIndex: number) {
  for (let i = fromIndex; i < Math.min(fromIndex + 2, state.queue.length); i++) {
    getResolved(state.queue[i]).catch(() => {});
  }
}

// ---- silence for "recite back" gaps (keeps the audio session alive in background) ----
const silenceCache = new Map<number, string>();
function silenceUrl(seconds: number): string {
  const secs = Math.max(0.5, Math.round(seconds * 2) / 2);
  const hit = silenceCache.get(secs);
  if (hit) return hit;
  const rate = 8000;
  const n = Math.floor(rate * secs);
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, 'data');
  v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128);
  const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  silenceCache.set(secs, url);
  return url;
}

// ---- core ----
async function startAudio(src: string, rate: number) {
  audio.src = src;
  audio.defaultPlaybackRate = rate;
  audio.playbackRate = rate;
  try {
    await audio.play();
    setState({ playing: true, error: null });
  } catch (e) {
    if ((e as Error).name !== 'AbortError') setState({ playing: false, error: (e as Error).message });
  }
}

async function playIndex(i: number) {
  const it = state.queue[i];
  if (!it) return;
  const my = ++token;
  setState({ index: i, repeatIteration: 0, inGap: false, loading: true, progress: 0, error: null });
  updateMediaSession();
  let resolved: ResolvedAudio;
  try {
    resolved = await getResolved(it);
  } catch (e) {
    if (my === token) setState({ loading: false, playing: false, error: (e as Error).message });
    return;
  }
  if (my !== token) return;
  currentAyahSrc = resolved.src;
  setState({ loading: false });
  await startAudio(resolved.src, getState().settings.speed);
  prefetch(i + 1);
}

function replayCurrent() {
  if (!currentAyahSrc) return playIndex(state.index);
  setState({ inGap: false, progress: 0 });
  void startAudio(currentAyahSrc, getState().settings.speed);
}

function advance() {
  const { repeatAyah, loop } = getState().settings;
  if (state.repeatIteration + 1 < repeatAyah) {
    setState({ repeatIteration: state.repeatIteration + 1 });
    replayCurrent();
    return;
  }
  if (state.index + 1 < state.queue.length) {
    void playIndex(state.index + 1);
  } else if (loop && state.queue.length) {
    void playIndex(0);
  } else {
    token++;
    setState({ playing: false, inGap: false, index: 0, progress: 0, repeatIteration: 0 });
  }
}

audio.addEventListener('ended', () => {
  if (state.inGap) {
    setState({ inGap: false });
    advance();
    return;
  }
  const it = state.queue[state.index];
  if (it?.passageId && state.repeatIteration === 0) markPlayed(it.passageId, !!it.last);

  const { gap, speed } = getState().settings;
  const seconds = gap === -1 ? (isFinite(audio.duration) ? audio.duration / speed : 0) : gap;
  if (seconds > 0) {
    setState({ inGap: true, progress: 1 });
    void startAudio(silenceUrl(seconds), 1);
  } else {
    advance();
  }
});

audio.addEventListener('timeupdate', () => {
  if (state.inGap || !isFinite(audio.duration) || audio.duration <= 0) return;
  const p = audio.currentTime / audio.duration;
  if (Math.abs(p - state.progress) > 0.01) setState({ progress: p });
});
audio.addEventListener('pause', () => {
  if (!audio.ended) setState({ playing: false });
});
audio.addEventListener('play', () => setState({ playing: true }));
audio.addEventListener('error', () => {
  if (!audio.getAttribute('src')) return;
  setState({ playing: false, loading: false, error: 'audio' });
});

// ---- media session (lock screen, headset buttons, car) ----
function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const it = state.queue[state.index];
  if (!it) return;
  const s = getSurah(it.surah);
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${s.name} · ${it.ayah}`,
      artist: reciterName(getState().settings.reciter),
      album: state.title,
      artwork: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  } catch {
    /* unsupported */
  }
}

if ('mediaSession' in navigator) {
  const set = (a: MediaSessionAction, h: MediaSessionActionHandler) => {
    try {
      navigator.mediaSession.setActionHandler(a, h);
    } catch {
      /* unsupported action */
    }
  };
  set('play', () => player.play());
  set('pause', () => player.pause());
  set('stop', () => player.pause());
  set('nexttrack', () => player.next());
  set('previoustrack', () => player.prev());
}

// ---- public API ----
export const player = {
  load(queue: QueueItem[], opts: { title: string; sourceKey: string; startIndex?: number }) {
    if (!queue.length) return;
    setState({ queue, title: opts.title, sourceKey: opts.sourceKey });
    void playIndex(Math.min(opts.startIndex ?? 0, queue.length - 1));
  },
  play() {
    if (!state.queue.length) return;
    if (audio.getAttribute('src') && !audio.ended) {
      void audio.play().catch(() => {});
    } else {
      void playIndex(state.index);
    }
  },
  pause() {
    audio.pause();
  },
  toggle() {
    if (state.playing) this.pause();
    else this.play();
  },
  next() {
    if (state.index + 1 < state.queue.length) void playIndex(state.index + 1);
    else if (state.queue.length) void playIndex(0);
  },
  prev() {
    if (!state.inGap && audio.currentTime > 2) {
      replayCurrent();
      setState({ repeatIteration: 0 });
    } else {
      void playIndex(Math.max(0, state.index - 1));
    }
  },
  jump(index: number) {
    void playIndex(index);
  },
  setSpeed(rate: number) {
    if (!state.inGap) {
      audio.playbackRate = rate;
      audio.defaultPlaybackRate = rate;
    }
  },
  stop() {
    token++;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    currentAyahSrc = null;
    setState(initial);
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const usePlayer = () => useSyncExternalStore(subscribe, () => state);
export const currentItem = (s: PlayerState): QueueItem | undefined => s.queue[s.index];

export function passageQueue(p: { id: string; surah: number; from: number; to: number }): QueueItem[] {
  const q: QueueItem[] = [];
  for (let a = p.from; a <= p.to; a++) q.push({ surah: p.surah, ayah: a, passageId: p.id, last: a === p.to });
  return q;
}
