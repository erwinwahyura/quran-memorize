import { useEffect, useState } from 'react';
import { cacheAyah, countCached, removeCached, requestPersistence } from '../lib/audioCache';
import { useT } from '../lib/i18n';
import { getPassageText } from '../lib/quran';
import { useSettings } from '../lib/store';
import { CheckIcon, DownloadIcon } from './Icons';

/** Saves a range's audio (current reciter) + text for offline listening. */
export function OfflineButton({ surah, from, to }: { surah: number; from: number; to: number }) {
  const t = useT();
  const { reciter, translations } = useSettings();
  const total = to - from + 1;
  const [cached, setCached] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    countCached(reciter, surah, from, to).then((n) => alive && setCached(n));
    return () => {
      alive = false;
    };
  }, [reciter, surah, from, to, busy]);

  const download = async () => {
    void requestPersistence();
    setBusy(0);
    getPassageText(surah, from, to, translations).catch(() => {});
    let done = 0;
    // A few parallel downloads keeps it quick without hammering the server.
    const queue = Array.from({ length: total }, (_, i) => from + i);
    const worker = async () => {
      for (let a = queue.shift(); a !== undefined; a = queue.shift()) {
        await cacheAyah(reciter, surah, a);
        setBusy(++done);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setBusy(null);
  };

  if (busy !== null) {
    return (
      <button className="btn small" disabled>
        <span className="spinner" /> {t.downloading(busy, total)}
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
            setCached(0);
          }
        }}
      >
        <CheckIcon size={16} /> {t.downloaded}
      </button>
    );
  }
  return (
    <button className="btn small" onClick={download}>
      <DownloadIcon size={16} /> {t.download}
      {cached ? ` (${cached}/${total})` : ''}
    </button>
  );
}
