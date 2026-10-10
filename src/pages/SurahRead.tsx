import { useState } from 'react';
import { BackIcon, LanguageIcon, PauseIcon, PlayIcon, PlusIcon, XIcon } from '../components/Icons';
import { Reader } from '../components/Reader';
import { useT } from '../lib/i18n';
import { afterPassageSaved } from '../lib/offline';
import { currentItem, player, usePlayer, type QueueItem } from '../lib/player';
import { back, navigate } from '../lib/router';
import { addPassage, passageLabel, updateSettings, useSettings } from '../lib/store';
import { getSurah } from '../lib/surahs';

export function SurahRead({ surah }: { surah: number }) {
  const t = useT();
  const settings = useSettings();
  const ps = usePlayer();
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const s = getSurah(surah);
  if (!s) return null;

  const key = `surah:${surah}`;
  const isThis = ps.sourceKey === key;
  const cur = currentItem(ps);

  const start = (ayah = 1) => {
    const q: QueueItem[] = Array.from({ length: s.ayahs }, (_, i) => ({ surah, ayah: i + 1 }));
    player.load(q, { title: `${s.name}`, sourceKey: key, startIndex: ayah - 1 });
  };

  const onAyah = (a: number) => {
    if (!selecting) return start(a);
    if (anchor === null) {
      setAnchor(a);
      setSel([a, a]);
    } else {
      setSel([Math.min(anchor, a), Math.max(anchor, a)]);
      setAnchor(null);
    }
  };

  return (
    <div className="page">
      <header className="page-head compact sticky">
        <button className="icon-btn" onClick={() => back('/quran')} aria-label="Back">
          <BackIcon />
        </button>
        <div className="head-title">
          <h1>
            {s.number}. {s.name}
          </h1>
          <span className="muted small">
            {s.meaning} · {t.ayat(s.ayahs)}
          </span>
        </div>
        <span className="arabic-sm head-arabic">{s.arabic}</span>
      </header>

      <div className="toolbar">
        <button className="btn primary" onClick={() => (isThis ? player.toggle() : start())}>
          {isThis && ps.playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          {isThis && ps.playing ? t.pause : t.playSurah}
        </button>
        <button
          className={`chip${settings.showTranslation ? ' on' : ''}`}
          onClick={() => updateSettings({ showTranslation: !settings.showTranslation })}
        >
          <LanguageIcon size={14} /> {t.translation}
        </button>
        <button
          className={`chip${selecting ? ' on' : ''}`}
          onClick={() => {
            setSelecting((x) => !x);
            setSel(null);
            setAnchor(null);
          }}
        >
          {selecting ? <XIcon size={14} /> : <PlusIcon size={14} />} {t.selectToAdd}
        </button>
      </div>
      {selecting && <p className="hint">{t.selectHint}</p>}

      <Reader
        surah={surah}
        from={1}
        to={s.ayahs}
        activeAyah={isThis ? cur?.ayah : null}
        onAyahClick={onAyah}
        selection={selecting ? sel : null}
      />

      {selecting && sel && (
        <div className="floating-action">
          <button
            className="btn primary"
            onClick={() => {
              const p = addPassage({ surah, from: sel[0], to: sel[1] });
              afterPassageSaved(p);
              setSelecting(false);
              setSel(null);
              navigate(`/p/${p.id}`);
            }}
          >
            <PlusIcon size={16} /> {t.addSelected(passageLabel({ surah, from: sel[0], to: sel[1] }))}
          </button>
        </div>
      )}
    </div>
  );
}
