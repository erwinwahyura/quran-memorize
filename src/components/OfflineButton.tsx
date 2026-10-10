import { removeCached } from '../lib/audioCache';
import { useT } from '../lib/i18n';
import { ensureOffline, markChanged, useCachedCount, useDownloadProgress } from '../lib/offline';
import { useSettings } from '../lib/store';
import { CheckIcon, DownloadIcon } from './Icons';

/** Saves a range's audio (current reciter) + text for offline listening. */
export function OfflineButton({ surah, from, to }: { surah: number; from: number; to: number }) {
  const t = useT();
  const { reciter } = useSettings();
  const range = { surah, from, to };
  const total = to - from + 1;
  const cached = useCachedCount(range, reciter);
  const busy = useDownloadProgress(range);

  if (busy) {
    return (
      <button className="btn small" disabled>
        <span className="spinner" /> {t.downloading(busy.done, busy.total)}
      </button>
    );
  }
  if (cached === total) {
    return (
      <button
        className="btn small ok"
        title={t.removeDownload}
        onClick={async () => {
          if (confirm(t.removeDownload + '?')) {
            await removeCached(reciter, surah, from, to);
            markChanged();
          }
        }}
      >
        <CheckIcon size={16} /> {t.downloaded}
      </button>
    );
  }
  return (
    <button className="btn small" onClick={() => void ensureOffline(range)}>
      <DownloadIcon size={16} /> {t.download}
      {cached ? ` (${cached}/${total})` : ''}
    </button>
  );
}

/** Small status shown on library cards. */
export function OfflineBadge({ surah, from, to }: { surah: number; from: number; to: number }) {
  const t = useT();
  const { reciter } = useSettings();
  const range = { surah, from, to };
  const cached = useCachedCount(range, reciter);
  const busy = useDownloadProgress(range);
  if (busy) {
    return (
      <span className="tag">
        ↓ {busy.done}/{busy.total}
      </span>
    );
  }
  if (cached === to - from + 1) {
    return (
      <span className="tag ok">
        <CheckIcon size={11} /> {t.offlineBadge}
      </span>
    );
  }
  return null;
}
