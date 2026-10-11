import { useSyncExternalStore } from 'react';
import { resolveAudio } from './audioCache';
import { reciterName } from './reciters';
import { getState, markPlayed, subscribeStore } from './store';
import { getSurah } from './surahs';

// Background-safe player.
//
// Phones (iOS especially) suspend a web app's JavaScript shortly after its audio
// stops. Switching <audio> sources between ayat therefore stalls playback when
// the screen is off. Instead, ayat — including repeats and "recite back" gaps —
// are decoded and stitched into one continuous WAV "segment". A typical hafalan
// passage fits in a single segment that loops natively (audio.loop), so no JS
// has to run in the background at all. Long queues are split into segments of
// up to SEG_MAX seconds; the next one is rendered ahead of time so the switch on
// `ended` is synchronous.

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
  let changed = false;
  for (const k in patch) {
    if (patch[k as keyof PlayerState] !== state[k as keyof PlayerState]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const SR = 24000; // mono 16-bit @ 24 kHz ≈ 2.9 MB per minute — clear for recitation
const SEG_MAX = 8 * 60; // seconds per segment
const QUICK_START = 60; // first segment of long queues (e.g. a whole surah) starts fast
const FADE = Math.round(SR * 0.004); // tiny fades avoid clicks at joins

const audio = new Audio();
audio.preload = 'auto';
(audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;

// ---- decoding ----
let decodeCtx: OfflineAudioContext | null = null;
const ctx = () => (decodeCtx ??= new OfflineAudioContext(1, 1, SR));

const DECODE_MAX = 40;
const decoded = new Map<string, Promise<Float32Array>>();

function decodeItem(it: QueueItem): Promise<Float32Array> {
  const { reciter, autoDownload } = getState().settings;
  const key = `${reciter}:${it.surah}:${it.ayah}`;
  let p = decoded.get(key);
  if (p) {
    decoded.delete(key);
    decoded.set(key, p); // refresh LRU position
    return p;
  }
  p = (async () => {
    const r = await resolveAudio(reciter, it.surah, it.ayah, autoDownload);
    try {
      const res = await fetch(r.src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await ctx().decodeAudioData(await res.arrayBuffer());
      if (buf.numberOfChannels === 1) return buf.getChannelData(0);
      const out = new Float32Array(buf.length);
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels;
      }
      return out;
    } finally {
      r.revoke?.();
    }
  })();
  p.catch(() => decoded.delete(key));
  decoded.set(key, p);
  while (decoded.size > DECODE_MAX) decoded.delete(decoded.keys().next().value as string);
  return p;
}

// ---- segments ----
interface Unit {
  u: number; // global unit index = queueIndex * repeat + rep
  qi: number;
  rep: number;
  start: number; // seconds within the segment
  audioEnd: number; // end of recitation; [audioEnd, end) is the gap
  end: number;
}

interface Segment {
  startUnit: number;
  endUnit: number; // exclusive
  units: Unit[];
  url: string;
  duration: number;
}

class Cancelled extends Error {}

let token = 0; // invalidates in-flight renders
let seg: Segment | null = null;
let next: { start: number; promise: Promise<Segment>; value?: Segment } | null = null;
let curK = -1; // index into seg.units of the unit being heard
let skipFinish = false; // set on programmatic seeks so they don't count as listens
let endedAtEnd = false; // played to the end with loop off

const repeat = () => Math.max(1, getState().settings.repeatAyah);
const totalUnits = () => state.queue.length * repeat();
const isWhole = (s: Segment) => s.startUnit === 0 && s.endUnit === totalUnits();

async function buildSegment(startUnit: number, my: number, maxSec: number): Promise<Segment> {
  const R = repeat();
  const { gap } = getState().settings;
  const total = totalUnits();
  const units: Unit[] = [];
  const chunks: { data: Float32Array; at: number }[] = [];
  let t = 0;
  for (let u = startUnit; u < total; u++) {
    const qi = Math.floor(u / R);
    // Decode a few ayat ahead in parallel.
    for (let k = 1; k <= 3 && qi + k < state.queue.length; k++) void decodeItem(state.queue[qi + k]).catch(() => {});
    const data = await decodeItem(state.queue[qi]);
    if (my !== token) throw new Cancelled();
    const dur = data.length / SR;
    const gapSec = gap === -1 ? dur : Math.max(0, gap);
    if (units.length && t + dur + gapSec > maxSec) break;
    const end = t + dur + gapSec;
    units.push({ u, qi, rep: u % R, start: t, audioEnd: t + dur, end });
    chunks.push({ data, at: Math.round(t * SR) });
    t = end; // reuse the exact value so unit boundaries match
  }
  const url = URL.createObjectURL(encodeWav(chunks, Math.ceil(t * SR) + 1));
  return { startUnit, endUnit: startUnit + units.length, units, url, duration: t };
}

function encodeWav(chunks: { data: Float32Array; at: number }[], n: number): Blob {
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, SR, true);
  v.setUint32(28, SR * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * 2, true);
  const pcm = new Int16Array(buf, 44, n);
  for (const { data, at } of chunks) {
    const len = Math.min(data.length, n - at);
    for (let i = 0; i < len; i++) {
      let s = data[i];
      if (i < FADE) s *= i / FADE;
      else if (len - i < FADE) s *= (len - i) / FADE;
      s = s < -1 ? -1 : s > 1 ? 1 : s;
      pcm[at + i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

function dropNext() {
  if (!next) return;
  next.promise.then((s) => URL.revokeObjectURL(s.url)).catch(() => {});
  next = null;
}

function scheduleNext() {
  dropNext();
  if (!seg || isWhole(seg)) return;
  const start = seg.endUnit < totalUnits() ? seg.endUnit : getState().settings.loop ? 0 : null;
  if (start === null) return;
  const my = token;
  const entry: NonNullable<typeof next> = { start, promise: buildSegment(start, my, SEG_MAX) };
  next = entry;
  entry.promise
    .then((s) => {
      if (next === entry) entry.value = s;
      else URL.revokeObjectURL(s.url);
    })
    .catch(() => {});
}

function applyRate() {
  const { speed } = getState().settings;
  audio.defaultPlaybackRate = speed;
  audio.playbackRate = speed;
}

function swapTo(s: Segment, autoplay: boolean, offset = 0) {
  const old = seg;
  seg = s;
  curK = -1;
  endedAtEnd = false;
  audio.src = s.url;
  audio.loop = isWhole(s) && getState().settings.loop;
  applyRate();
  if (offset) audio.currentTime = offset;
  if (old && old.url !== s.url) URL.revokeObjectURL(old.url);
  setState({ loading: false });
  if (autoplay) {
    audio.play().catch((e: Error) => {
      if (e.name !== 'AbortError') setState({ playing: false, error: e.message });
    });
  }
  onTime();
  scheduleNext();
}

async function startAt(unit: number, autoplay = true) {
  const my = ++token;
  dropNext();
  const R = repeat();
  setState({
    index: Math.floor(unit / R),
    repeatIteration: unit % R,
    loading: true,
    error: null,
    progress: 0,
    inGap: false,
  });
  updateMediaSession();
  // Short passages render whole (native loop); long queues start quickly.
  const maxSec = state.queue.length <= 40 ? SEG_MAX : QUICK_START;
  try {
    const s = await buildSegment(unit, my, maxSec);
    if (my !== token) {
      URL.revokeObjectURL(s.url);
      return;
    }
    swapTo(s, autoplay);
  } catch (e) {
    if (e instanceof Cancelled || my !== token) return;
    setState({ loading: false, playing: false, error: navigator.onLine ? 'audio' : 'offline' });
  }
}

function finishUnit(unit: Unit) {
  if (skipFinish) return;
  const it = state.queue[unit.qi];
  if (it?.passageId && unit.rep === 0) markPlayed(it.passageId, !!it.last);
}

function onTime() {
  if (!seg) return;
  const t = audio.currentTime;
  let k = seg.units.findIndex((x) => t < x.end);
  if (k === -1) k = seg.units.length - 1;
  if (k !== curK) {
    // Moving forward, or wrapping around in a native loop, means the previous unit was heard.
    if (curK >= 0 && (k > curK || (audio.loop && k < curK))) finishUnit(seg.units[curK]);
    const ayahChanged = curK < 0 || seg.units[curK]?.qi !== seg.units[k].qi;
    curK = k;
    skipFinish = false;
    if (ayahChanged) queueMicrotask(updateMediaSession);
  }
  const x = seg.units[k];
  const inGap = t >= x.audioEnd;
  const progress = inGap ? 1 : Math.min(1, (t - x.start) / Math.max(0.01, x.audioEnd - x.start));
  setState({
    index: x.qi,
    repeatIteration: x.rep,
    inGap,
    progress: Math.abs(progress - state.progress) > 0.01 || progress === 0 ? progress : state.progress,
  });
}

function seekToUnit(u: number) {
  endedAtEnd = false;
  if (seg && u >= seg.startUnit && u < seg.endUnit) {
    skipFinish = true;
    curK = -1;
    audio.currentTime = seg.units[u - seg.startUnit].start + 0.01;
    if (audio.paused) void audio.play().catch(() => {});
    onTime();
  } else {
    void startAt(u);
  }
}

audio.addEventListener('timeupdate', onTime);
audio.addEventListener('ended', () => {
  if (!seg) return;
  finishUnit(seg.units[seg.units.length - 1]);
  if (!next) {
    // End of queue with loop off.
    endedAtEnd = true;
    setState({ playing: false, index: 0, progress: 0, repeatIteration: 0, inGap: false });
    return;
  }
  // Take ownership first so scheduleNext() inside swapTo doesn't revoke it.
  const upcoming = next;
  next = null;
  if (upcoming.value) {
    swapTo(upcoming.value, true); // synchronous: keeps the audio session alive in background
  } else {
    const my = token;
    setState({ loading: true });
    upcoming.promise
      .then((s) => (my === token ? swapTo(s, true) : URL.revokeObjectURL(s.url)))
      .catch(() => setState({ loading: false, error: 'audio' }));
  }
});
audio.addEventListener('pause', () => {
  if (!audio.ended) setState({ playing: false });
});
audio.addEventListener('play', () => setState({ playing: true }));
audio.addEventListener('error', () => {
  if (!audio.getAttribute('src')) return;
  setState({ playing: false, loading: false, error: 'audio' });
});

// Re-render when settings that change the audio change.
let lastSig = '';
const sigOf = () => {
  const s = getState().settings;
  return `${s.reciter}|${s.repeatAyah}|${s.gap}`;
};
let lastLoop = getState().settings.loop;
subscribeStore(() => {
  const s = getState().settings;
  if (s.speed !== audio.playbackRate && seg) applyRate();
  const sig = sigOf();
  if (sig !== lastSig) {
    const prev = lastSig;
    lastSig = sig;
    if (prev && seg && state.queue.length) {
      // Keep the current ayah; rebuild the audio around it.
      void startAt(state.index * repeat(), state.playing);
      return;
    }
  }
  if (s.loop !== lastLoop) {
    lastLoop = s.loop;
    if (seg) {
      audio.loop = isWhole(seg) && s.loop;
      scheduleNext();
    }
  }
});
lastSig = sigOf();

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
    token++;
    dropNext();
    setState({ queue, title: opts.title, sourceKey: opts.sourceKey });
    void startAt(Math.min(opts.startIndex ?? 0, queue.length - 1) * repeat());
  },
  play() {
    if (!state.queue.length) return;
    if (!seg || endedAtEnd) void startAt(state.index * repeat());
    else void audio.play().catch(() => {});
  },
  pause() {
    audio.pause();
  },
  toggle() {
    if (state.playing) this.pause();
    else this.play();
  },
  next() {
    const qi = state.index + 1 < state.queue.length ? state.index + 1 : 0;
    seekToUnit(qi * repeat());
  },
  prev() {
    const x = seg && curK >= 0 ? seg.units[curK] : null;
    const into = x ? audio.currentTime - x.start : 0;
    if (!state.inGap && into > 2) seekToUnit(state.index * repeat());
    else seekToUnit(Math.max(0, state.index - 1) * repeat());
  },
  jump(index: number) {
    seekToUnit(index * repeat());
  },
  setSpeed(_rate: number) {
    applyRate();
  },
  stop() {
    token++;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (seg) URL.revokeObjectURL(seg.url);
    seg = null;
    dropNext();
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
