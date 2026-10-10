import { get, set } from 'idb-keyval';

// Quran text via api.alquran.cloud. Every fetched (edition, surah, range) is kept
// in IndexedDB so passages stay readable offline.
const API = 'https://api.alquran.cloud/v1';
export const ARABIC_EDITION = 'quran-uthmani';

export interface Ayah {
  number: number; // number in surah
  arabic: string;
  translations: Record<string, string>;
}

type EditionTexts = Record<number, string>; // numberInSurah -> text

const key = (edition: string, surah: number, from: number, to: number) => `text:${edition}:${surah}:${from}-${to}`;

// In-memory layer on top of IndexedDB.
const mem = new Map<string, EditionTexts>();

async function readCached(k: string): Promise<EditionTexts | undefined> {
  if (mem.has(k)) return mem.get(k);
  try {
    const v = await get<EditionTexts>(k);
    if (v) mem.set(k, v);
    return v;
  } catch {
    return undefined;
  }
}

async function fetchEditions(surah: number, from: number, to: number, editions: string[]): Promise<Record<string, EditionTexts>> {
  const url = `${API}/surah/${surah}/editions/${editions.join(',')}?offset=${from - 1}&limit=${to - from + 1}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load text (HTTP ${res.status})`);
  const json = (await res.json()) as { data: unknown };
  const list = (Array.isArray(json.data) ? json.data : [json.data]) as {
    edition: { identifier: string };
    ayahs: { numberInSurah: number; text: string }[];
  }[];
  const out: Record<string, EditionTexts> = {};
  for (const ed of list) {
    const texts: EditionTexts = {};
    for (const a of ed.ayahs) {
      // Filter defensively in case the API ignores offset/limit.
      if (a.numberInSurah >= from && a.numberInSurah <= to) texts[a.numberInSurah] = a.text;
    }
    out[ed.edition.identifier] = texts;
  }
  return out;
}

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const normalize = (s: string) => s.replace(DIACRITICS, '').replace(/[ٱأإآ]/g, 'ا');

/** alquran.cloud prefixes ayah 1 of most surahs with the basmalah; we show it as a header instead. */
export function stripBasmalah(surah: number, ayah: number, text: string): string {
  if (ayah !== 1 || surah === 1 || surah === 9) return text;
  const words = text.split(/\s+/);
  if (words.length > 4 && normalize(words[0]).startsWith('بسم') && normalize(words[3]).includes('رحيم')) {
    return words.slice(4).join(' ');
  }
  return text;
}

export const BASMALAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

export async function getPassageText(
  surah: number,
  from: number,
  to: number,
  translations: string[],
  opts: { offlineOnly?: boolean } = {},
): Promise<Ayah[]> {
  const editions = [ARABIC_EDITION, ...translations];
  const result: Record<string, EditionTexts> = {};
  const missing: string[] = [];
  for (const ed of editions) {
    const cached = await readCached(key(ed, surah, from, to));
    if (cached) result[ed] = cached;
    else missing.push(ed);
  }
  if (missing.length && !opts.offlineOnly) {
    try {
      const fetched = await fetchEditions(surah, from, to, missing);
      for (const [ed, texts] of Object.entries(fetched)) {
        result[ed] = texts;
        const k = key(ed, surah, from, to);
        mem.set(k, texts);
        set(k, texts).catch(() => {});
      }
    } catch (e) {
      if (!result[ARABIC_EDITION]) throw e;
      // Arabic is available offline; translations just won't show.
    }
  }
  if (!result[ARABIC_EDITION]) throw new Error('offline');

  const ayahs: Ayah[] = [];
  for (let n = from; n <= to; n++) {
    const tr: Record<string, string> = {};
    for (const t of translations) if (result[t]?.[n]) tr[t] = result[t][n];
    ayahs.push({ number: n, arabic: stripBasmalah(surah, n, result[ARABIC_EDITION][n] ?? ''), translations: tr });
  }
  return ayahs;
}
