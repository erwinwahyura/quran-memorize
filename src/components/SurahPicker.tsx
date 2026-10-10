import { useMemo, useState } from 'react';
import { useT } from '../lib/i18n';
import { SURAHS, type Surah } from '../lib/surahs';

const simplify = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');

export function filterSurahs(q: string): Surah[] {
  const n = simplify(q);
  if (!n) return SURAHS;
  return SURAHS.filter(
    (s) =>
      String(s.number) === n ||
      simplify(s.name).includes(n) ||
      simplify(s.name.replace(/^(al|an|ar|as|at|ad|adh|ash|az)-/i, '')).startsWith(n) ||
      s.arabic.includes(q.trim()) ||
      simplify(s.meaning).includes(n),
  );
}

export function SurahPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const t = useT();
  const [q, setQ] = useState('');
  const list = useMemo(() => filterSurahs(q), [q]);
  return (
    <div className="surah-picker">
      <input type="search" placeholder={t.searchSurah} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="surah-options" role="listbox">
        {list.map((s) => (
          <li key={s.number}>
            <button
              type="button"
              role="option"
              aria-selected={value === s.number}
              className={value === s.number ? 'on' : ''}
              onClick={() => onChange(s.number)}
            >
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
