import { useMemo, useState } from 'react';
import { filterSurahs } from '../components/SurahPicker';
import { useT } from '../lib/i18n';
import { navigate } from '../lib/router';

export function QuranIndex() {
  const t = useT();
  const [q, setQ] = useState('');
  const list = useMemo(() => filterSurahs(q), [q]);
  return (
    <div className="page">
      <header className="page-head">
        <h1>{t.navQuran}</h1>
      </header>
      <input className="search" type="search" placeholder={t.searchSurah} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="surah-options full">
        {list.map((s) => (
          <li key={s.number}>
            <button onClick={() => navigate(`/quran/${s.number}`)}>
              <span className="num">{s.number}</span>
              <span className="name">
                {s.name}
                <small>
                  {s.meaning} · {t.ayat(s.ayahs)}
                </small>
              </span>
              <span className="arabic-sm">{s.arabic}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
