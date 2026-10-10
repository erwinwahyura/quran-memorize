import { useState } from 'react';
import { useT } from '../lib/i18n';
import { currentItem, player, usePlayer } from '../lib/player';
import { RECITERS } from '../lib/reciters';
import { navigate } from '../lib/router';
import { updateSettings, useSettings } from '../lib/store';
import { getSurah } from '../lib/surahs';
import { ChevronDownIcon, ChevronUpIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, RepeatIcon, XIcon } from './Icons';

const REPEATS = [1, 2, 3, 5, 7, 10];
const SPEEDS = [0.75, 1, 1.25, 1.5];
const GAPS = [0, 2, 5, -1];

export function PlayerBar() {
  const t = useT();
  const s = usePlayer();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const it = currentItem(s);
  if (!it) return null;
  const surah = getSurah(it.surah);

  const goSource = () => {
    if (!s.sourceKey) return;
    if (s.sourceKey.startsWith('p:')) navigate(`/p/${s.sourceKey.slice(2)}`);
    else if (s.sourceKey.startsWith('surah:')) navigate(`/quran/${s.sourceKey.slice(6)}`);
    else if (it.passageId) navigate(`/p/${it.passageId}`);
  };

  return (
    <div className={`player${open ? ' open' : ''}`} role="region" aria-label={t.nowPlaying}>
      <div className="player-progress">
        <div style={{ width: `${(s.inGap ? 1 : s.progress) * 100}%` }} className={s.inGap ? 'gap' : ''} />
      </div>

      {open && (
        <div className="player-panel">
          <div className="panel-row">
            <label>
              <RepeatIcon size={16} /> {t.repeatAyah}
            </label>
            <div className="chips">
              {REPEATS.map((n) => (
                <button
                  key={n}
                  className={`chip${settings.repeatAyah === n ? ' on' : ''}`}
                  onClick={() => updateSettings({ repeatAyah: n })}
                >
                  {t.times(n)}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-row">
            <label>{t.gap}</label>
            <div className="chips">
              {GAPS.map((g) => (
                <button
                  key={g}
                  className={`chip${settings.gap === g ? ' on' : ''}`}
                  onClick={() => updateSettings({ gap: g })}
                >
                  {g === 0 ? t.gapNone : g === -1 ? t.gapAuto : `${g}s`}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-row">
            <label>{t.speed}</label>
            <div className="chips">
              {SPEEDS.map((r) => (
                <button
                  key={r}
                  className={`chip${settings.speed === r ? ' on' : ''}`}
                  onClick={() => {
                    updateSettings({ speed: r });
                    player.setSpeed(r);
                  }}
                >
                  {r}×
                </button>
              ))}
            </div>
          </div>
          <div className="panel-row">
            <label>{t.reciter}</label>
            <select value={settings.reciter} onChange={(e) => updateSettings({ reciter: e.target.value })}>
              {RECITERS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="panel-row inline">
            <button
              className={`chip${settings.loop ? ' on' : ''}`}
              onClick={() => updateSettings({ loop: !settings.loop })}
            >
              <RepeatIcon size={14} /> {settings.loop ? t.loopOn : t.loopOff}
            </button>
            <button className="chip" onClick={() => player.stop()}>
              <XIcon size={14} /> {t.close}
            </button>
          </div>
        </div>
      )}

      <div className="player-main">
        <button className="player-info" onClick={goSource}>
          <span className="player-title">
            {surah.name} · {it.ayah}
            {settings.repeatAyah > 1 && (
              <span className="badge">
                {s.repeatIteration + 1}/{settings.repeatAyah}
              </span>
            )}
          </span>
          <span className="player-sub">
            {s.error ? '⚠ ' + (s.error === 'audio' ? t.loadError : s.error) : s.inGap ? '…' : s.title}
          </span>
        </button>
        <div className="player-controls">
          <button className="icon-btn" onClick={() => player.prev()} aria-label={t.prev}>
            <PrevIcon />
          </button>
          <button
            className="icon-btn play"
            onClick={() => player.toggle()}
            aria-label={s.playing ? t.pause : t.play}
            disabled={s.loading}
          >
            {s.loading ? <span className="spinner" /> : s.playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button className="icon-btn" onClick={() => player.next()} aria-label={t.next}>
            <NextIcon />
          </button>
          <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Options" aria-expanded={open}>
            {open ? <ChevronDownIcon /> : <ChevronUpIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}
