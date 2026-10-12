import { Fragment, type ReactNode } from 'react';
import { BackIcon } from '../components/Icons';
import { GUIDE } from '../lib/guide';
import { useT } from '../lib/i18n';
import { back, navigate } from '../lib/router';
import { useSettings } from '../lib/store';

/** Renders **bold** segments. */
function rich(text: string): ReactNode {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>));
}

export function Guide() {
  const t = useT();
  const { uiLang } = useSettings();
  const sections = GUIDE[uiLang] ?? GUIDE.en;

  return (
    <div className="page guide">
      <header className="page-head compact">
        <button className="icon-btn" onClick={() => back('/')} aria-label="Back">
          <BackIcon />
        </button>
        <h1>{t.guideTitle}</h1>
      </header>
      <p className="muted">{t.guideIntro}</p>

      <div className="guide-list">
        {sections.map((s, i) => (
          <details key={s.id} className="guide-item" open={i === 0}>
            <summary>
              <span className="guide-icon" aria-hidden>
                {s.icon}
              </span>
              <span>{s.title}</span>
            </summary>
            <div className="guide-body">
              {s.intro && <p>{rich(s.intro)}</p>}
              <ol>
                {s.steps.map((step, j) => (
                  <li key={j}>{rich(step)}</li>
                ))}
              </ol>
              {s.tip && <p className="guide-tip">💡 {rich(s.tip)}</p>}
            </div>
          </details>
        ))}
      </div>

      <div className="row-actions center-row">
        <button className="btn primary" onClick={() => navigate('/add')}>
          {t.guideStart}
        </button>
      </div>
    </div>
  );
}
