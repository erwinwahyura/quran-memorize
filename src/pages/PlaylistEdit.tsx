import { useState } from 'react';
import { BackIcon } from '../components/Icons';
import { useT } from '../lib/i18n';
import { back } from '../lib/router';
import {
  addPlaylist,
  deletePlaylist,
  passageLabel,
  updatePlaylist,
  updateSettings,
  usePassages,
  usePlaylists,
} from '../lib/store';
import { getSurah } from '../lib/surahs';

export function PlaylistEdit({ id }: { id?: string }) {
  const t = useT();
  const passages = usePassages();
  const existing = usePlaylists().find((pl) => pl.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [picked, setPicked] = useState<Set<string>>(() => new Set(existing?.passageIds ?? []));

  const toggle = (pid: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    // Keep library order rather than tap order.
    const passageIds = passages.filter((p) => picked.has(p.id)).map((p) => p.id);
    if (existing) {
      updatePlaylist(existing.id, { name: n, passageIds });
    } else {
      const pl = addPlaylist(n, passageIds);
      updateSettings({ activePlaylist: pl.id });
    }
    back();
  };

  const remove = () => {
    if (!existing || !confirm(t.confirmDeletePlaylist)) return;
    deletePlaylist(existing.id);
    back();
  };

  return (
    <div className="page">
      <header className="page-head compact">
        <button className="icon-btn" onClick={() => back()} aria-label="Back">
          <BackIcon />
        </button>
        <h1>{existing ? t.editPlaylist : t.newPlaylist}</h1>
      </header>

      <form className="form" onSubmit={submit}>
        {!existing && <p className="hint">{t.playlistHint}</p>}
        <div className="field">
          <label htmlFor="pl-name">{t.playlistName}</label>
          <input
            id="pl-name"
            type="text"
            placeholder={t.playlistNamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!existing}
            required
          />
        </div>

        <div className="field">
          <div className="field-head">
            <label>
              {t.playlistPick} ({picked.size})
            </label>
            <button
              type="button"
              className="link-btn"
              onClick={() => setPicked(picked.size === passages.length ? new Set() : new Set(passages.map((p) => p.id)))}
            >
              {picked.size === passages.length ? t.selectNone : t.selectAll}
            </button>
          </div>
          <ul className="pick-list">
            {passages.map((p) => (
              <li key={p.id}>
                <label className={`pick-row${picked.has(p.id) ? ' on' : ''}`}>
                  <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
                  <span className="pick-text">
                    <span className="passage-title">{passageLabel(p)}</span>
                    {p.note && <small className="muted">{p.note}</small>}
                  </span>
                  <span className="arabic-sm">{getSurah(p.surah).arabic}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="form-actions">
          {existing && (
            <button type="button" className="btn danger push-start" onClick={remove}>
              {t.deletePlaylist}
            </button>
          )}
          <button type="button" className="btn" onClick={() => back()}>
            {t.cancel}
          </button>
          <button type="submit" className="btn primary" disabled={!name.trim()}>
            {t.save}
          </button>
        </div>
      </form>
    </div>
  );
}
