import { directAudioUrl, proxiedAudioUrl } from './reciters';

// Recitation audio stored in Cache Storage for offline listening.
const CACHE = 'qm-audio-v1';

const isAudio = (res: Response) => {
  const ct = res.headers.get('content-type') ?? '';
  return res.ok && (ct.startsWith('audio/') || ct.includes('octet-stream'));
};

async function openCache(): Promise<Cache | null> {
  try {
    return 'caches' in self ? await caches.open(CACHE) : null;
  } catch {
    return null;
  }
}

export async function isCached(reciter: string, surah: number, ayah: number): Promise<boolean> {
  const c = await openCache();
  return !!(c && (await c.match(proxiedAudioUrl(reciter, surah, ayah))));
}

/** Download one ayah into the offline cache. Returns false if unavailable. */
export async function cacheAyah(reciter: string, surah: number, ayah: number): Promise<boolean> {
  const c = await openCache();
  if (!c) return false;
  const url = proxiedAudioUrl(reciter, surah, ayah);
  if (await c.match(url)) return true;
  try {
    const res = await fetch(url);
    if (!isAudio(res)) return false;
    await c.put(url, res);
    return true;
  } catch {
    return false;
  }
}

export async function countCached(reciter: string, surah: number, from: number, to: number): Promise<number> {
  const c = await openCache();
  if (!c) return 0;
  let n = 0;
  for (let a = from; a <= to; a++) if (await c.match(proxiedAudioUrl(reciter, surah, a))) n++;
  return n;
}

export async function removeCached(reciter: string, surah: number, from: number, to: number): Promise<void> {
  const c = await openCache();
  if (!c) return;
  for (let a = from; a <= to; a++) await c.delete(proxiedAudioUrl(reciter, surah, a));
}

export async function clearAudioCache(): Promise<void> {
  try {
    await caches.delete(CACHE);
  } catch {
    /* ignore */
  }
}

export interface ResolvedAudio {
  src: string;
  revoke?: () => void;
}

/**
 * Resolve a playable src for an ayah: cached blob → fetched blob (stored if
 * `store`) → direct everyayah URL (when the host has no /audio proxy).
 */
export async function resolveAudio(reciter: string, surah: number, ayah: number, store: boolean): Promise<ResolvedAudio> {
  const url = proxiedAudioUrl(reciter, surah, ayah);
  const c = await openCache();
  let res = c ? await c.match(url) : undefined;
  if (!res) {
    try {
      const fetched = await fetch(url);
      if (isAudio(fetched)) {
        if (c && store) await c.put(url, fetched.clone()).catch(() => {});
        res = fetched;
      }
    } catch {
      /* offline or no proxy */
    }
  }
  if (res) {
    const blob = await res.blob();
    const src = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'audio/mpeg' }));
    return { src, revoke: () => URL.revokeObjectURL(src) };
  }
  return { src: directAudioUrl(reciter, surah, ayah) };
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null;
  } catch {
    return null;
  }
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
