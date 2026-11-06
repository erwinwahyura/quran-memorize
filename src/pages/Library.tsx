import { InstallCard } from '../components/InstallCard';
import { OfflineBadge } from '../components/OfflineButton';
import { HeadphonesIcon, PauseIcon, PlayIcon, PlusIcon, RepeatIcon } from '../components/Icons';
import { relativeDay, useT } from '../lib/i18n';
import { currentItem, passageQueue, player, usePlayer } from '../lib/player';
import { navigate } from '../lib/router';
import {
  needsReview,
  passageLabel,
  playlistPassages,
  updateSettings,
  usePassages,
  usePlaylists,
  useSettings,
  type Passage,
} from '../lib/store';
import { getSurah } from '../lib/surahs';

export function playPassages(list: Passage[], title: string, sourceKey: string) {
  player.load(list.flatMap(passageQueue), { title, sourceKey });
}

export function Library() {
  const t = useT();
  const passages = usePassages();
  const settings = useSettings();
  const playlists = usePlaylists();
  const ps = usePlayer();
  const playingId = currentItem(ps)?.passageId;
  const review = passages.filter((p) => needsReview(p, settings.reviewDays));
  const active = playlists.find((pl) => pl.id === settings.activePlaylist);
  const shown = active ? playlistPassages(active, passages) : passages;
  const selectPlaylist = (id: string) => updateSettings({ activePlaylist: id });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{t.appName}</h1>
          <p className="muted">{t.tagline}</p>
        </div>
        <div className="head-actions">
          <button className="icon-btn help-btn" onClick={() => navigate('/guide')} aria-label={t.guideTitle} title={t.guideTitle}>
            ?
          </button>
          <button className="btn primary" onClick={() => navigate('/add')}>
            <PlusIcon size={18} /> {t.add}
          </button>
        </div>
      </header>

      <InstallCard />

      {passages.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <HeadphonesIcon size={40} />
          </div>
          <h2>{t.emptyTitle}</h2>
          <p className="muted">{t.emptyBody}</p>
          <button className="btn primary" onClick={() => navigate('/add')}>
            <PlusIcon size={18} /> {t.addPassage}
          </button>
          <p>
            <button className="link-btn" onClick={() => navigate('/guide')}>
              {t.guideLink}
            </button>
          </p>
        </div>
      ) : (
        <>
          {review.length > 0 && (
            <div className="review-banner">
              <span>{t.reviewBanner(review.length)}</span>
              <button className="btn small" onClick={() => playPassages(review, t.playReview, 'review')}>
                <PlayIcon size={14} /> {t.playReview}
              </button>
            </div>
          )}
          <div className="playlist-bar" role="tablist" aria-label={t.playlists}>
            <button
              role="tab"
              aria-selected={!active}
              className={`chip${!active ? ' on' : ''}`}
              onClick={() => selectPlaylist('')}
            >
              {t.allHafalan} <span className="count">{passages.length}</span>
            </button>
            {playlists.map((pl) => (
              <button
                key={pl.id}
                role="tab"
                aria-selected={active?.id === pl.id}
                className={`chip${active?.id === pl.id ? ' on' : ''}`}
                onClick={() => selectPlaylist(pl.id)}
              >
                {pl.name} <span className="count">{playlistPassages(pl, passages).length}</span>
              </button>
            ))}
            <button className="chip dashed" onClick={() => navigate('/playlist/new')}>
              <PlusIcon size={14} /> {t.newPlaylist}
            </button>
          </div>
          <div className="row-actions">
            <button
              className="btn"
              disabled={!shown.length}
              onClick={() => playPassages(shown, active ? active.name : t.playAll, active ? `pl:${active.id}` : 'all')}
            >
              <PlayIcon size={16} /> {t.playAll}
            </button>
            <button
              className={`chip${settings.loop ? ' on' : ''}`}
              aria-pressed={settings.loop}
              onClick={() => updateSettings({ loop: !settings.loop })}
            >
              <RepeatIcon size={14} /> {t.loop}
            </button>
            {active && (
              <button className="btn small push-end" onClick={() => navigate(`/playlist/${active.id}`)}>
                {t.edit}
              </button>
            )}
          </div>
          {active && !shown.length && <p className="hint">{t.playlistEmpty}</p>}
          <ul className="passage-list">
            {shown.map((p) => {
              const s = getSurah(p.surah);
              const stale = needsReview(p, settings.reviewDays);
              const isPlaying = playingId === p.id;
              return (
                <li key={p.id} className={`passage-card${isPlaying ? ' playing' : ''}`}>
                  <button className="passage-body" onClick={() => navigate(`/p/${p.id}`)}>
                    <div className="passage-top">
                      <span className="passage-title">{passageLabel(p)}</span>
                      <span className="arabic-sm">{s.arabic}</span>
                    </div>
                    {p.note && <div className="passage-note">{p.note}</div>}
                    <div className="passage-meta">
                      <span>{t.ayat(p.to - p.from + 1)}</span>
                      <span className={stale ? 'warn' : ''}>
                        {p.lastPlayedAt ? t.lastPlayed(relativeDay(t, p.lastPlayedAt)) : t.neverPlayed}
                      </span>
                      {stale && <span className="tag warn">{t.needsReview}</span>}
                      <OfflineBadge surah={p.surah} from={p.from} to={p.to} />
                    </div>
                  </button>
                  <button
                    className="icon-btn play"
                    aria-label={isPlaying && ps.playing ? t.pause : t.play}
                    onClick={() =>
                      isPlaying ? player.toggle() : playPassages([p], passageLabel(p), `p:${p.id}`)
                    }
                  >
                    {isPlaying && ps.playing ? <PauseIcon /> : <PlayIcon />}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
