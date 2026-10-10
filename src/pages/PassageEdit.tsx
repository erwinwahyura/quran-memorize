import { useState } from 'react';
import { BackIcon } from '../components/Icons';
import { SurahPicker } from '../components/SurahPicker';
import { useT } from '../lib/i18n';
import { afterPassageSaved } from '../lib/offline';
import { back, navigate } from '../lib/router';
import { addPassage, updatePassage, usePassages } from '../lib/store';
import { getSurah } from '../lib/surahs';

export function PassageEdit({ id }: { id?: string }) {
  const t = useT();
  const passages = usePassages();
  const existing = id ? passages.find((p) => p.id === id) : undefined;

  const [surah, setSurah] = useState<number | null>(existing?.surah ?? null);
  const [picking, setPicking] = useState(!existing);
  const [from, setFrom] = useState(String(existing?.from ?? 1));
  const [to, setTo] = useState(String(existing?.to ?? ''));
  const [note, setNote] = useState(existing?.note ?? '');
  const [err, setErr] = useState<string | null>(null);

  const s = surah ? getSurah(surah) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!s) return;
    const f = parseInt(from, 10);
    const tt = parseInt(to || from, 10);
    if (!(f >= 1 && tt >= f && tt <= s.ayahs)) {
      setErr(t.invalidRange);
      return;
    }
    const data = { surah: s.number, from: f, to: tt, note: note.trim() || undefined };
    afterPassageSaved(data);
    if (existing) {
      updatePassage(existing.id, data);
      navigate(`/p/${existing.id}`);
    } else {
      const p = addPassage(data);
      navigate(`/p/${p.id}`);
    }
  };

  return (
    <div className="page">
      <header className="page-head compact">
        <button className="icon-btn" onClick={() => back()} aria-label="Back">
          <BackIcon />
        </button>
        <h1>{existing ? t.editPassage : t.addPassage}</h1>
      </header>

      <form className="form" onSubmit={submit}>
        <div className="field">
          <label>{t.surah}</label>
          {s && !picking ? (
            <button type="button" className="selected-surah" onClick={() => setPicking(true)}>
              <span className="num">{s.number}</span>
              <span className="name">
                {s.name}
                <small>
                  {s.meaning} · {t.ayat(s.ayahs)}
                </small>
              </span>
              <span className="arabic-sm">{s.arabic}</span>
            </button>
          ) : (
            <SurahPicker
              value={surah ?? 0}
              onChange={(n) => {
                setSurah(n);
                setPicking(false);
                setFrom('1');
                setTo(String(getSurah(n).ayahs));
                setErr(null);
              }}
            />
          )}
        </div>

        {s && !picking && (
          <>
            <div className="field-row">
              <div className="field">
                <label htmlFor="from">{t.fromAyah}</label>
                <input
                  id="from"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={s.ayahs}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <div className="field">
                <label htmlFor="to">{t.toAyah}</label>
                <input
                  id="to"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={s.ayahs}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="note">{t.note}</label>
              <input
                id="note"
                type="text"
                placeholder={t.notePlaceholder}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {err && <p className="error">{err}</p>}
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => back()}>
                {t.cancel}
              </button>
              <button type="submit" className="btn primary">
                {t.save}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
