import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BookIcon, HeadphonesIcon, SettingsIcon } from './components/Icons';
import { PlayerBar } from './components/PlayerBar';
import { useT } from './lib/i18n';
import { syncAllOffline } from './lib/offline';
import { usePlayer } from './lib/player';
import { navigate, useRoute } from './lib/router';
import { useSettings } from './lib/store';
import { Library } from './pages/Library';
import { PassageEdit } from './pages/PassageEdit';
import { PassagePage } from './pages/PassagePage';
import { QuranIndex } from './pages/QuranIndex';
import { Settings } from './pages/Settings';
import { SurahRead } from './pages/SurahRead';

function Page({ route }: { route: string }) {
  let m: RegExpMatchArray | null;
  if (route === '/add') return <PassageEdit />;
  if ((m = route.match(/^\/edit\/(.+)$/))) return <PassageEdit key={m[1]} id={m[1]} />;
  if ((m = route.match(/^\/p\/(.+)$/))) return <PassagePage key={m[1]} id={m[1]} />;
  if (route === '/quran') return <QuranIndex />;
  if ((m = route.match(/^\/quran\/(\d{1,3})$/)) && +m[1] >= 1 && +m[1] <= 114)
    return <SurahRead key={m[1]} surah={+m[1]} />;
  if (route === '/settings') return <Settings />;
  return <Library />;
}

export function App() {
  const route = useRoute();
  const t = useT();
  const { uiLang } = useSettings();
  const ps = usePlayer();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    document.documentElement.lang = uiLang;
  }, [uiLang]);
  // Braces matter: newer browsers return a Promise from scrollTo(), and React
  // would treat a returned value as this effect's cleanup function.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  // Keep the whole hafalan downloaded: on start, when back online, and after
  // switching reciter or translations.
  const { saveOnAdd, reciter, translations } = useSettings();
  const trKey = translations.join(',');
  useEffect(() => {
    if (!saveOnAdd) return;
    void syncAllOffline();
    const onOnline = () => void syncAllOffline();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [saveOnAdd, reciter, trKey]);

  const tab = route.startsWith('/quran') ? 'quran' : route.startsWith('/settings') ? 'settings' : 'library';
  const hasPlayer = ps.queue.length > 0;

  return (
    <div className={`app${hasPlayer ? ' with-player' : ''}`}>
      {needRefresh && (
        <div className="update-bar">
          {t.updateReady}
          <button className="btn small" onClick={() => updateServiceWorker(true)}>
            {t.reload}
          </button>
        </div>
      )}
      <main>
        <ErrorBoundary key={route}>
          <Page route={route} />
        </ErrorBoundary>
      </main>
      <div className="bottom">
        <PlayerBar />
        <nav className="tabbar">
          <button className={tab === 'library' ? 'on' : ''} onClick={() => navigate('/')}>
            <HeadphonesIcon />
            <span>{t.navLibrary}</span>
          </button>
          <button className={tab === 'quran' ? 'on' : ''} onClick={() => navigate('/quran')}>
            <BookIcon />
            <span>{t.navQuran}</span>
          </button>
          <button className={tab === 'settings' ? 'on' : ''} onClick={() => navigate('/settings')}>
            <SettingsIcon />
            <span>{t.navSettings}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
