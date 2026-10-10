import { useEffect, useState } from 'react';
import { useT } from '../lib/i18n';
import { XIcon } from './Icons';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const subs = new Set<() => void>();
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  subs.forEach((f) => f());
});

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const DISMISS_KEY = 'qm-install-dismissed';

export function InstallCard() {
  const t = useT();
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  useEffect(() => {
    const f = () => force((x) => x + 1);
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);

  if (dismissed || isStandalone() || (!deferred && !isIos())) return null;

  return (
    <div className="install-card">
      <div>
        <strong>{t.install}</strong>
        <p className="muted">{deferred ? t.installHint : t.iosInstall}</p>
      </div>
      {deferred && (
        <button
          className="btn primary small"
          onClick={async () => {
            await deferred?.prompt();
            deferred = null;
            force((x) => x + 1);
          }}
        >
          {t.install}
        </button>
      )}
      <button
        className="icon-btn"
        aria-label={t.close}
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1');
          setDismissed(true);
        }}
      >
        <XIcon size={18} />
      </button>
    </div>
  );
}
