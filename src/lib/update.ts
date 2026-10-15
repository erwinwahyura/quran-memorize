// Manual "Check for updates". When a new version is found, App's needRefresh
// handling applies it (immediately, or once playback stops).
export async function checkForUpdate(): Promise<'found' | 'latest' | 'offline' | 'unsupported'> {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  if (!navigator.onLine) return 'offline';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'unsupported';
  if (reg.waiting) return 'found';
  try {
    await reg.update();
  } catch {
    return 'offline';
  }
  // A found update installs in the background; give it a moment.
  for (let i = 0; i < 40; i++) {
    if (reg.waiting) return 'found';
    if (!reg.installing && i > 3) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  return reg.waiting ? 'found' : 'latest';
}
