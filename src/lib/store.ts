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
  saveOnAdd: boolean; // download a passage for offline as soon as it's added
  analytics: boolean; // share anonymous usage stats
  /** Playlist shown on the library page; '' = all hafalan. */
  activePlaylist: string;
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

/** A named group of passages, e.g. "Juz 30" or "This week" — played together. */
export interface Playlist {
  id: string;
  name: string;
  passageIds: string[];
}

interface State {
  settings: Settings;
  passages: Passage[];
  playlists: Playlist[];
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
  saveOnAdd: true,
  analytics: true,
  activePlaylist: '',
};

const LS_KEY = 'qm-state-v1';

// Guards against corrupted storage or hand-edited backups crashing the UI.
function isValidPassage(p: Partial<Passage> | null): p is Passage {
  if (!p || typeof p.surah !== 'number' || typeof p.from !== 'number' || typeof p.to !== 'number') return false;
  const s = getSurah(p.surah);
  return !!s && p.from >= 1 && p.from <= p.to && p.to <= s.ayahs;
}

// Drops malformed playlists and ids of passages that no longer exist.
function cleanPlaylists(list: unknown, passages: Passage[]): Playlist[] {
  if (!Array.isArray(list)) return [];
  const ids = new Set(passages.map((p) => p.id));
  return (list as Partial<Playlist>[])
    .filter((pl) => pl && typeof pl.id === 'string' && typeof pl.name === 'string')
    .map((pl) => ({
      id: pl.id!,
      name: pl.name!,
      passageIds: Array.isArray(pl.passageIds) ? pl.passageIds.filter((id) => ids.has(id)) : [],
    }));
}

function load(): State {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      const passages = Array.isArray(parsed.passages) ? parsed.passages.filter(isValidPassage) : [];
      return {
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        passages,
        playlists: cleanPlaylists(parsed.playlists, passages),
      };
    }
  } catch {
    /* fall through */
  }
  return { settings: DEFAULT_SETTINGS, passages: [], playlists: [] };
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
export const subscribeStore = subscribe;

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
export const usePlaylists = () => useSyncExternalStore(subscribe, () => state.playlists);

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
  commit({
    ...state,
    passages: state.passages.filter((p) => p.id !== id),
    playlists: state.playlists.map((pl) => ({ ...pl, passageIds: pl.passageIds.filter((x) => x !== id) })),
  });
}

// ---- playlists ----
export function addPlaylist(name: string, passageIds: string[] = []): Playlist {
  const pl: Playlist = { id: uid(), name, passageIds };
  commit({ ...state, playlists: [...state.playlists, pl] });
  return pl;
}

export function updatePlaylist(id: string, patch: Partial<Omit<Playlist, 'id'>>) {
  commit({ ...state, playlists: state.playlists.map((pl) => (pl.id === id ? { ...pl, ...patch } : pl)) });
}

export function deletePlaylist(id: string) {
  const settings = state.settings.activePlaylist === id ? { ...state.settings, activePlaylist: '' } : state.settings;
  commit({ ...state, settings, playlists: state.playlists.filter((pl) => pl.id !== id) });
}

/** Adds or removes one passage from a playlist. */
export function togglePlaylistPassage(playlistId: string, passageId: string, on: boolean) {
  const pl = state.playlists.find((x) => x.id === playlistId);
  if (!pl || pl.passageIds.includes(passageId) === on) return;
  updatePlaylist(playlistId, {
    passageIds: on ? [...pl.passageIds, passageId] : pl.passageIds.filter((x) => x !== passageId),
  });
}

/** The playlist's passages, in library (mushaf) order. */
export function playlistPassages(pl: Playlist, passages: Passage[]): Passage[] {
  const ids = new Set(pl.passageIds);
  return passages.filter((p) => ids.has(p.id));
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
  const valid = data.passages.filter(isValidPassage);
  const rangeKey = (p: Passage) => `${p.surah}:${p.from}-${p.to}`;
  const existing = new Map(state.passages.map((p) => [rangeKey(p), p.id]));
  const taken = new Set(state.passages.map((p) => p.id));
  // Backup passage id -> id on this device (an existing passage with the same range, or the imported one).
  const idMap = new Map<string, string>();
  const added: Passage[] = [];
  for (const p of valid) {
    const local = existing.get(rangeKey(p));
    if (local) {
      if (p.id) idMap.set(p.id, local);
      continue;
    }
    const id = p.id && !taken.has(p.id) ? p.id : uid();
    if (p.id) idMap.set(p.id, id);
    taken.add(id);
    existing.set(rangeKey(p), id);
    added.push({ ...p, id, playCount: p.playCount ?? 0, createdAt: p.createdAt ?? Date.now() });
  }

  // Merge playlists by name.
  const playlists = state.playlists.map((pl) => ({ ...pl, passageIds: [...pl.passageIds] }));
  if (Array.isArray(data.playlists)) {
    for (const raw of data.playlists as Partial<Playlist>[]) {
      if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) continue;
      const ids = (Array.isArray(raw.passageIds) ? raw.passageIds : [])
        .map((x) => idMap.get(x))
        .filter((x): x is string => !!x);
      const same = playlists.find((pl) => pl.name.trim().toLowerCase() === raw.name!.trim().toLowerCase());
      if (same) same.passageIds = [...new Set([...same.passageIds, ...ids])];
      else playlists.push({ id: uid(), name: raw.name.trim(), passageIds: [...new Set(ids)] });
    }
  }

  // A backup's active playlist id means nothing on this device.
  const { activePlaylist: _ignored, ...importedSettings } = data.settings ?? ({} as Partial<Settings>);
  commit({
    settings: { ...state.settings, ...importedSettings },
    passages: sortPassages([...state.passages, ...added]),
    playlists,
  });
  return added.length;
}
