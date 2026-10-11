import { useEffect, useState, useSyncExternalStore } from 'react';
import { cacheAyah, countCached, removeCached, requestPersistence } from './audioCache';
import { getPassageText } from './quran';
import { RECITERS } from './reciters';
import { getState, type Passage } from './store';

// Background downloader that keeps hafalan passages (audio + text) available offline.

export interface Progress {
  done: number;
  total: number;
}

type Range = { surah: number; from: number; to: number };

const jobs = new Map<string, Promise<boolean>>();
let progress = new Map<string, Progress>();
let version = 0; // bumps whenever something finishes, so status hooks recount
const listeners = new Set<() => void>();
const emit = () => {
  progress = new Map(progress);
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const jobKey = (reciter: string, r: Range) => `${reciter}:${r.surah}:${r.from}-${r.to}`;

/** Download a range for the current reciter. Resolves true when every ayah is stored. */
export function ensureOffline(r: Range): Promise<boolean> {
  const { reciter, translations } = getState().settings;
  const key = jobKey(reciter, r);
  const running = jobs.get(key);
  if (running) return running;

  const job = (async () => {
    void requestPersistence();
    getPassageText(r.surah, r.from, r.to, translations).catch(() => {});
    const ayat = Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from + i);
    const p: Progress = { done: 0, total: ayat.length };
    progress.set(key, p);
    emit();
    let ok = true;
    // A few parallel downloads keeps it quick without hammering the server.
    const worker = async () => {
      for (let a = ayat.shift(); a !== undefined; a = ayat.shift()) {
        if (!(await cacheAyah(reciter, r.surah, a))) ok = false;
        progress.set(key, { ...p, done: ++p.done });
        emit();
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    progress.delete(key);
    version++;
    emit();
    return ok;
  })().finally(() => jobs.delete(key));

  jobs.set(key, job);
  return job;
}

/** Download every passage in the library (one at a time). */
export async function syncAllOffline(): Promise<void> {
  if (!navigator.onLine) return;
  for (const p of getState().passages) await ensureOffline(p);
}

/** Drop stored audio for a deleted passage, keeping ayat other passages still use. */
export async function forgetOffline(removed: Range, remaining: Passage[]): Promise<void> {
  for (let a = removed.from; a <= removed.to; a++) {
    const used = remaining.some((p) => p.surah === removed.surah && a >= p.from && a <= p.to);
    if (used) continue;
    for (const r of RECITERS) await removeCached(r.id, removed.surah, a, a);
  }
  version++;
  emit();
}

export function useDownloadProgress(r: Range): Progress | null {
  const { reciter } = getState().settings;
  const map = useSyncExternalStore(subscribe, () => progress);
  return map.get(jobKey(reciter, r)) ?? null;
}

/** How many ayat of the range are stored for the current reciter (null while counting). */
export function useCachedCount(r: Range, reciter: string): number | null {
  const v = useSyncExternalStore(subscribe, () => version);
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    countCached(reciter, r.surah, r.from, r.to).then((c) => alive && setN(c));
    return () => {
      alive = false;
    };
  }, [reciter, r.surah, r.from, r.to, v]);
  return n;
}

/** Called after a passage is added or edited. */
export function afterPassageSaved(r: Range) {
  if (getState().settings.saveOnAdd) void ensureOffline(r);
}

export function markChanged() {
  version++;
  emit();
}
