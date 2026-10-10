import { useState } from 'react';
import { BackIcon, EditIcon, EyeOffIcon, LanguageIcon, PauseIcon, PlayIcon, TrashIcon } from '../components/Icons';
import { OfflineButton } from '../components/OfflineButton';
import { Reader } from '../components/Reader';
import { relativeDay, useT } from '../lib/i18n';
import { forgetOffline } from '../lib/offline';
import { currentItem, passageQueue, player, usePlayer } from '../lib/player';
import { back, navigate } from '../lib/router';
import { deletePassage, getState, passageLabel, updateSettings, usePassages, useSettings } from '../lib/store';
import { getSurah } from '../lib/surahs';

export function PassagePage({ id }: { id: string }) {
  const t = useT();
  const passages = usePassages();
  const settings = useSettings();
  const ps = usePlayer();
  const [hide, setHide] = useState(false);
  const p = passages.find((x) => x.id === id);

  if (!p) {
    return (
      <div className="page">
        <div className="state-box">
          <p className="muted">404</p>
          <button className="btn" onClick={() => navigate('/')}>
            {t.navLibrary}
          </button>
        </div>
      </div>
    );
  }

  const s = getSurah(p.surah);
  const label = passageLabel(p);
  const cur = currentItem(ps);
  const isThis = cur?.passageId === p.id;
  const start = (ayah = p.from) =>
    player.load(passageQueue(p), { title: label, sourceKey: `p:${p.id}`, startIndex: ayah - p.from });

  return (
    <div className="page">
      <header className="page-head compact sticky">
        <button className="icon-btn" onClick={() => back()} aria-label="Back">
          <BackIcon />
        </button>
        <div className="head-title">
          <h1>{label}</h1>
          <span className="muted small">
            {s.meaning} · {p.lastPlayedAt ? t.lastPlayed(relativeDay(t, p.lastPlayedAt)) : t.neverPlayed}
          </span>
        </div>
        <span className="arabic-sm head-arabic">{s.arabic}</span>
      </header>

      {p.note && <p className="passage-note standalone">{p.note}</p>}

      <div className="toolbar">
        <button
          className="btn primary"
          onClick={() => (isThis ? player.toggle() : start())}
        >
          {isThis && ps.playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          {isThis && ps.playing ? t.pause : t.play}
        </button>
        <button
          className={`chip${settings.showTranslation ? ' on' : ''}`}
          onClick={() => updateSettings({ showTranslation: !settings.showTranslation })}
        >
          <LanguageIcon size={14} /> {t.translation}
        </button>
        <button className={`chip${hide ? ' on' : ''}`} onClick={() => setHide((h) => !h)}>
          <EyeOffIcon size={14} /> {t.hideText}
        </button>
      </div>

      <Reader
        surah={p.surah}
        from={p.from}
        to={p.to}
        activeAyah={isThis ? cur?.ayah : null}
        hideText={hide}
        onAyahClick={(a) => start(a)}
      />

      <div className="footer-actions">
        <OfflineButton surah={p.surah} from={p.from} to={p.to} />
        <button className="btn small" onClick={() => navigate(`/edit/${p.id}`)}>
          <EditIcon size={16} /> {t.edit}
        </button>
        <button
          className="btn small danger"
          onClick={() => {
            if (confirm(t.confirmDelete)) {
              if (isThis) player.stop();
              deletePassage(p.id);
              void forgetOffline(p, getState().passages);
              navigate('/');
            }
          }}
        >
          <TrashIcon size={16} /> {t.delete}
        </button>
      </div>
    </div>
  );
}
