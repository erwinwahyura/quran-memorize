import { useEffect, useMemo, useRef, useState } from 'react';
import { APP_VERSION } from '../components/ErrorBoundary';
import { clearAudioCache, countCached, requestPersistence, storageEstimate } from '../lib/audioCache';
import { markChanged, syncAllOffline } from '../lib/offline';
import { UI_LANGS, useT } from '../lib/i18n';
import { RECITERS } from '../lib/reciters';
import { navigate } from '../lib/router';
import { exportData, importData, updateSettings, usePassages, useSettings, type UiLang } from '../lib/store';
import { CURATED_TRANSLATIONS, loadAllTranslations, translationInfo, type TranslationEdition } from '../lib/translations';

const fmtBytes = (b: number) =>
  b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`;

export function Settings() {
  const t = useT();
  const settings = useSettings();
  const [all, setAll] = useState<TranslationEdition[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [filter, setFilter] = useState('');
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const passages = usePassages();
  const [offlineN, setOfflineN] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [persistTried, setPersistTried] = useState(false);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);
  const isIosBrowser =
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(navigator as Navigator & { standalone?: boolean }).standalone &&
    !window.matchMedia('(display-mode: standalone)').matches;

  const refreshOffline = async () => {
    let n = 0;
    for (const p of passages) if ((await countCached(settings.reciter, p.surah, p.from, p.to)) === p.to - p.from + 1) n++;
    setOfflineN(n);
    setEst(await storageEstimate());
  };
  useEffect(() => {
    void refreshOffline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passages, settings.reciter]);

  const options = useMemo(() => {
    const list = all ?? CURATED_TRANSLATIONS;
    const f = filter.trim().toLowerCase();
    const filtered = f ? list.filter((x) => (x.name + x.id).toLowerCase().includes(f)) : list;
    // Selected ones first, in the order they were chosen.
    const selected = settings.translations.map(translationInfo);
    return [...selected, ...filtered.filter((x) => !settings.translations.includes(x.id))];
  }, [all, filter, settings.translations]);

  const toggleTr = (id: string) => {
    const has = settings.translations.includes(id);
    updateSettings({
      translations: has ? settings.translations.filter((x) => x !== id) : [...settings.translations, id],
    });
  };

  const doExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hafalan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t.settingsTitle}</h1>
      </header>

      <button className="card guide-card" onClick={() => navigate('/guide')}>
        <span className="guide-icon" aria-hidden>
          📖
        </span>
        <span>
          <strong>{t.guideTitle}</strong>
          <span className="muted small">{t.guideCard}</span>
        </span>
      </button>

      <section className="card">
        <div className="field">
          <label>{t.language}</label>
          <div className="chips">
            {UI_LANGS.map((l) => (
              <button
                key={l.id}
                className={`chip${settings.uiLang === l.id ? ' on' : ''}`}
                onClick={() => updateSettings({ uiLang: l.id as UiLang })}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="reciter">{t.reciter}</label>
          <select id="reciter" value={settings.reciter} onChange={(e) => updateSettings({ reciter: e.target.value })}>
            {RECITERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="size">
            {t.arabicSize}: {settings.arabicSize}px
          </label>
          <input
            id="size"
            type="range"
            min={20}
            max={48}
            step={2}
            value={settings.arabicSize}
            onChange={(e) => updateSettings({ arabicSize: +e.target.value })}
          />
          <p className="arabic preview" style={{ fontSize: settings.arabicSize }} dir="rtl" lang="ar">
            وَمَن جَآءَ بِٱلسَّيِّئَةِ فَكُبَّتْ وُجُوهُهُمْ فِى ٱلنَّارِ
          </p>
        </div>
        <div className="field">
          <label htmlFor="review">{t.reviewDays}</label>
          <div className="inline-input">
            <input
              id="review"
              type="number"
              min={1}
              max={365}
              value={settings.reviewDays}
              onChange={(e) => updateSettings({ reviewDays: Math.max(1, +e.target.value || 1) })}
            />
            <span>{t.days}</span>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>{t.translations}</h2>
        <p className="muted small">{t.translationsHint}</p>
        <input
          className="search"
          type="search"
          placeholder="🔍"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <ul className="check-list">
          {options.map((o) => (
            <li key={o.id}>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.translations.includes(o.id)}
                  onChange={() => toggleTr(o.id)}
                />
                <span>{o.name}</span>
              </label>
            </li>
          ))}
        </ul>
        {!all && (
          <button
            className="btn small"
            disabled={loadingAll}
            onClick={async () => {
              setLoadingAll(true);
              try {
                setAll(await loadAllTranslations());
              } catch {
                setMsg(t.loadError);
              } finally {
                setLoadingAll(false);
              }
            }}
          >
            {loadingAll ? t.loading : t.showAll}
          </button>
        )}
      </section>

      <section className="card">
        <h2>{t.offlineTitle}</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.saveOnAdd}
            onChange={(e) => updateSettings({ saveOnAdd: e.target.checked })}
          />
          <span>{t.saveOnAdd}</span>
        </label>
        <p className="muted small">{t.saveOnAddHint}</p>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.autoDownload}
            onChange={(e) => updateSettings({ autoDownload: e.target.checked })}
          />
          <span>{t.autoDownload}</span>
        </label>
        {passages.length > 0 && offlineN !== null && (
          <p className="small">{t.offlineCount(offlineN, passages.length)}</p>
        )}
        <div className="row-actions">
          <button
            className="btn small"
            disabled={syncing || offlineN === passages.length}
            onClick={async () => {
              setSyncing(true);
              await syncAllOffline();
              setSyncing(false);
              void refreshOffline();
            }}
          >
            {syncing ? <span className="spinner" /> : null} {t.downloadAll}
          </button>
        </div>
        {persisted !== null && (
          <div className={`notice${persisted ? ' ok' : ' warn'}`}>
            <p>{persisted ? '✓ ' + t.protectedYes : t.protectedNo}</p>
            {!persisted && (
              <>
                <button
                  className="btn small"
                  onClick={async () => {
                    setPersisted(await requestPersistence());
                    setPersistTried(true);
                  }}
                >
                  {t.protectBtn}
                </button>
                {persistTried && <p className="small">{t.protectHint}</p>}
              </>
            )}
          </div>
        )}
        {isIosBrowser && <div className="notice warn"><p>{t.iosBrowserWarn}</p></div>}
        {est && <p className="muted small">{t.storageUsed(fmtBytes(est.usage), fmtBytes(est.quota))}</p>}
        <button
          className="btn small danger"
          onClick={async () => {
            if (confirm(t.clearAudioConfirm)) {
              await clearAudioCache();
              markChanged();
              void refreshOffline();
            }
          }}
        >
          {t.clearAudio}
        </button>
      </section>

      <section className="card">
        <h2>{t.backup}</h2>
        <p className="muted small">{t.backupHint}</p>
        <div className="row-actions">
          <button className="btn small" onClick={doExport}>
            {t.exportBtn}
          </button>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            {t.importBtn}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setMsg(t.imported(importData(await f.text())));
              } catch (err) {
                setMsg((err as Error).message);
              }
              e.target.value = '';
            }}
          />
        </div>
      </section>

      {msg && (
        <p className="toast" onClick={() => setMsg(null)}>
          {msg}
        </p>
      )}

      <p className="muted small center">{t.about}</p>
      <p className="muted small center">Version {APP_VERSION}</p>
    </div>
  );
}
