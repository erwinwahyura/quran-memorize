import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '@fontsource/amiri-quran/400.css';
import './styles.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

const container = document.getElementById('root')!;
let root: Root;
let lastRecover = 0;

// If something outside the app (a browser extension, page translation) breaks
// React's view of the page, start over with a clean container instead of
// leaving the screen blank. Only once per few seconds, to avoid loops.
function recover(): boolean {
  const now = Date.now();
  if (now - lastRecover < 5000) return false;
  lastRecover = now;
  setTimeout(() => {
    try {
      root.unmount();
    } catch {
      /* already broken */
    }
    container.replaceChildren();
    mount();
  }, 0);
  return true;
}

function mount() {
  root = createRoot(container);
  root.render(
    <StrictMode>
      <ErrorBoundary onCrash={recover}>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

mount();
