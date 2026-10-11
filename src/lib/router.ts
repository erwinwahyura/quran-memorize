import { useSyncExternalStore } from 'react';

// Minimal hash router: #/, #/add, #/edit/:id, #/p/:id, #/quran, #/quran/:surah, #/settings
//
// In-app navigation updates the route directly instead of waiting for
// `hashchange`, which some browser tabs / in-app browsers don't fire reliably.
// hashchange + popstate are still handled for back/forward and typed URLs.
const readHash = () => location.hash.replace(/^#/, '') || '/';

let current = readHash();
let depth = 0; // how many in-app pages we can go back through
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function sync() {
  const h = readHash();
  if (h !== current) {
    current = h;
    emit();
  }
}
window.addEventListener('hashchange', sync);
window.addEventListener('popstate', () => {
  depth = Math.max(0, depth - 1);
  sync();
});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useRoute = () => useSyncExternalStore(subscribe, () => current);

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (path === current) return;
  const url = `${location.pathname}${location.search}#${path}`;
  if (opts.replace) history.replaceState(null, '', url);
  else {
    history.pushState(null, '', url);
    depth++;
  }
  current = path;
  emit();
}

export function back(fallback = '/') {
  // history.length also counts pages from other sites in a browser tab, so only
  // go back through history we created; otherwise jump to the fallback.
  if (depth > 0) history.back();
  else navigate(fallback, { replace: true });
}
