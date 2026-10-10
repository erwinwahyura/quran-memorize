import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import { BASMALAH, getPassageText, type Ayah } from '../lib/quran';
import { useSettings } from '../lib/store';
import { isRtl } from '../lib/translations';

const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);

interface Props {
  surah: number;
  from: number;
  to: number;
  /** Ayah number currently playing (highlighted + scrolled into view). */
  activeAyah?: number | null;
  onAyahClick?: (ayah: number) => void;
  hideText?: boolean;
  /** Inclusive selection range to highlight (range-select mode). */
  selection?: [number, number] | null;
}

export function Reader({ surah, from, to, activeAyah, onAyahClick, hideText, selection }: Props) {
  const t = useT();
  const settings = useSettings();
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [attempt, setAttempt] = useState(0);
  const refs = useRef(new Map<number, HTMLElement>());

  const trKey = settings.translations.join(',');
  useEffect(() => {
    let alive = true;
    let fresh = false;
    setError(null);
    // Show cached text immediately, then refresh with anything missing.
    getPassageText(surah, from, to, settings.translations, { offlineOnly: true })
      .then((a) => alive && !fresh && setAyahs(a))
      .catch(() => alive && !fresh && setAyahs(null));
    getPassageText(surah, from, to, settings.translations)
      .then((a) => {
        fresh = true;
        if (alive) setAyahs(a);
      })
      .catch((e: Error) => alive && setError(e.message === 'offline' || !navigator.onLine ? t.offlineError : t.loadError));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surah, from, to, trKey, attempt]);

  useEffect(() => setRevealed(new Set()), [hideText, surah, from, to]);

  useEffect(() => {
    if (activeAyah == null) return;
    const el = refs.current.get(activeAyah);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeAyah]);

  if (!ayahs && error) {
    return (
      <div className="state-box">
        <p>{error}</p>
        <button className="btn" onClick={() => setAttempt((x) => x + 1)}>
          {t.retry}
        </button>
      </div>
    );
  }
  if (!ayahs) return <div className="state-box muted">{t.loading}</div>;

  const showBasmalah = from === 1 && surah !== 1 && surah !== 9;

  return (
    <div className="reader">
      {showBasmalah && (
        <div className="basmalah arabic" style={{ fontSize: settings.arabicSize * 0.9 }}>
          {BASMALAH}
        </div>
      )}
      {hideText && <p className="hint">{t.hideTextHint}</p>}
      {ayahs.map((a) => {
        const active = activeAyah === a.number;
        const selected = selection && a.number >= selection[0] && a.number <= selection[1];
        const hidden = hideText && !revealed.has(a.number);
        return (
          <article
            key={a.number}
            ref={(el) => {
              if (el) refs.current.set(a.number, el);
              else refs.current.delete(a.number);
            }}
            className={`ayah${active ? ' active' : ''}${selected ? ' selected' : ''}`}
            onClick={() => {
              if (hidden) {
                setRevealed((s) => new Set(s).add(a.number));
                return;
              }
              onAyahClick?.(a.number);
            }}
          >
            <div className="ayah-head">
              <span className="ayah-num">
                {surah}:{a.number}
              </span>
            </div>
            <p
              className={`arabic${hidden ? ' hidden-text' : ''}`}
              lang="ar"
              dir="rtl"
              style={{ fontSize: settings.arabicSize }}
            >
              {a.arabic} <span className="ayah-end">﴿{toArabicDigits(a.number)}﴾</span>
            </p>
            {settings.showTranslation &&
              !hidden &&
              settings.translations.map((id) =>
                a.translations[id] ? (
                  <p key={id} className="translation" dir={isRtl(id) ? 'rtl' : 'ltr'}>
                    {a.translations[id]}
                  </p>
                ) : null,
              )}
          </article>
        );
      })}
    </div>
  );
}
