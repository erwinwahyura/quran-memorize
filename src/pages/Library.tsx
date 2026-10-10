import { InstallCard } from '../components/InstallCard';
import { OfflineBadge } from '../components/OfflineButton';
import { HeadphonesIcon, PauseIcon, PlayIcon, PlusIcon } from '../components/Icons';
import { relativeDay, useT } from '../lib/i18n';
import { currentItem, passageQueue, player, usePlayer } from '../lib/player';
import { navigate } from '../lib/router';
import { needsReview, passageLabel, usePassages, useSettings, type Passage } from '../lib/store';
import { getSurah } from '../lib/surahs';

export function playPassages(list: Passage[], title: string, sourceKey: string) {
  player.load(list.flatMap(passageQueue), { title, sourceKey });
}

export function Library() {
  const t = useT();
  const passages = usePassages();
  const settings = useSettings();
  const ps = usePlayer();
  const playingId = currentItem(ps)?.passageId;
  const review = passages.filter((p) => needsReview(p, settings.reviewDays));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{t.appName}</h1>
          <p className="muted">{t.tagline}</p>
        </div>
        <button className="btn primary" onClick={() => navigate('/add')}>
          <PlusIcon size={18} /> {t.add}
        </button>
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
          <div className="row-actions">
            <button className="btn" onClick={() => playPassages(passages, t.playAll, 'all')}>
              <PlayIcon size={16} /> {t.playAll}
            </button>
          </div>
          <ul className="passage-list">
            {passages.map((p) => {
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
