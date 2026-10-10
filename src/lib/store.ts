import { useSyncExternalStore } from 'react';
import { DEFAULT_RECITER } from './reciters';
import { getSurah } from './surahs';

export type UiLang = 'en' | 'id';

export interface Settings {
  uiLang: UiLang;
  reciter: string;
  translations: string[];
  showTranslation: boolean;
  arabicSize: number; // px
  reviewDays: number;
  repeatAyah: number; // times each ayah plays
  loop: boolean; // loop the whole queue
  speed: number;
  gap: number; // seconds of silence after each ayah; -1 = same length as the ayah
  autoDownload: boolean; // keep audio offline after it's played once
}

export interface Passage {
  id: string;
  surah: number;
  from: number;
  to: number;
  note?: string;
  createdAt: number;
  lastPlayedAt?: number;
  playCount: number;
}

interface State {
  settings: Settings;
  passages: Passage[];
}

const browserLang = (): UiLang => (navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en');

const DEFAULT_SETTINGS: Settings = {
  uiLang: browserLang(),
  reciter: DEFAULT_RECITER,
  translations: browserLang() === 'id' ? ['id.indonesian'] : ['en.sahih'],
  showTranslation: true,
  arabicSize: 30,
  reviewDays: 14,
  repeatAyah: 1,
  loop: true,
  speed: 1,
  gap: 0,
  autoDownload: true,
};

const LS_KEY = 'qm-state-v1';

function load(): State {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      return {
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        passages: Array.isArray(parsed.passages) ? parsed.passages : [],
      };
    }
  } catch {
    /* fall through */
  }
  return { settings: DEFAULT_SETTINGS, passages: [] };
}

let state: State = load();
const listeners = new Set<() => void>();

function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* storage full / private mode */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// Keep tabs in sync.
window.addEventListener('storage', (e) => {
  if (e.key === LS_KEY) {
    state = load();
    listeners.forEach((l) => l());
  }
});

export const getState = () => state;
export const useSettings = () => useSyncExternalStore(subscribe, () => state.settings);
export const usePassages = () => useSyncExternalStore(subscribe, () => state.passages);

export function updateSettings(patch: Partial<Settings>) {
  commit({ ...state, settings: { ...state.settings, ...patch } });
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function sortPassages(list: Passage[]): Passage[] {
  return [...list].sort((a, b) => a.surah - b.surah || a.from - b.from);
}

export function addPassage(p: Pick<Passage, 'surah' | 'from' | 'to' | 'note'>): Passage {
  const passage: Passage = { ...p, id: uid(), createdAt: Date.now(), playCount: 0 };
  commit({ ...state, passages: sortPassages([...state.passages, passage]) });
  return passage;
}

export function updatePassage(id: string, patch: Partial<Passage>) {
  commit({ ...state, passages: sortPassages(state.passages.map((p) => (p.id === id ? { ...p, ...patch } : p))) });
}

export function deletePassage(id: string) {
  commit({ ...state, passages: state.passages.filter((p) => p.id !== id) });
}

export function markPlayed(id: string, completed: boolean) {
  const p = state.passages.find((x) => x.id === id);
  if (!p) return;
  updatePassage(id, { lastPlayedAt: Date.now(), playCount: p.playCount + (completed ? 1 : 0) });
}

export const passageLabel = (p: { surah: number; from: number; to: number }) => {
  const s = getSurah(p.surah);
  return p.from === p.to ? `${s.name} ${p.from}` : `${s.name} ${p.from}–${p.to}`;
};

export function needsReview(p: Passage, reviewDays: number, now = Date.now()): boolean {
  const ref = p.lastPlayedAt ?? p.createdAt;
  return now - ref > reviewDays * 86400000;
}

// ---- backup ----
export function exportData(): string {
  return JSON.stringify({ app: 'quran-memorize', version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export function importData(json: string): number {
  const data = JSON.parse(json) as Partial<State>;
  if (!Array.isArray(data.passages)) throw new Error('Invalid backup file');
  const valid = data.passages.filter(
    (p) => p && typeof p.surah === 'number' && typeof p.from === 'number' && typeof p.to === 'number',
  );
  const existing = new Set(state.passages.map((p) => `${p.surah}:${p.from}-${p.to}`));
  const added = valid
    .filter((p) => !existing.has(`${p.surah}:${p.from}-${p.to}`))
    .map((p) => ({ ...p, id: p.id || uid(), playCount: p.playCount ?? 0, createdAt: p.createdAt ?? Date.now() }));
  commit({
    settings: { ...state.settings, ...(data.settings ?? {}) },
    passages: sortPassages([...state.passages, ...added]),
  });
  return added.length;
}
