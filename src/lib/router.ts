import { useSyncExternalStore } from 'react';

// Minimal hash router: #/, #/add, #/edit/:id, #/p/:id, #/quran, #/quran/:surah, #/settings
const getHash = () => location.hash.replace(/^#/, '') || '/';
const subscribe = (l: () => void) => {
  window.addEventListener('hashchange', l);
  return () => window.removeEventListener('hashchange', l);
};

export const useRoute = () => useSyncExternalStore(subscribe, getHash);
export const navigate = (path: string) => {
  location.hash = path;
};
export const back = (fallback = '/') => {
  if (history.length > 1) history.back();
  else navigate(fallback);
};
