import { Component, type ErrorInfo, type ReactNode } from 'react';

declare const __APP_VERSION__: string;
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

// Recent errors from anywhere (incl. outside React), shown in the fallback so
// a blank screen can be reported with a concrete message.
const recent: string[] = [];
const remember = (msg: string) => {
  recent.push(`${new Date().toISOString().slice(11, 19)} ${msg}`);
  if (recent.length > 5) recent.shift();
};
window.addEventListener('error', (e) => remember(e.message || String(e.error)));
window.addEventListener('unhandledrejection', (e) => remember('Unhandled: ' + String(e.reason?.message ?? e.reason)));

interface Props {
  children: ReactNode;
  /** Return true if the crash is being handled (e.g. the app is remounting). */
  onCrash?: () => boolean;
}

interface State {
  error: Error | null;
  stack: string;
  recovering: boolean;
}

// Keeps a crash from blanking the app, and shows the error so it can be reported.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: '', recovering: false };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info.componentStack);
    remember(error.message);
    this.setState({
      stack: (info.componentStack ?? '').trim().split('\n').slice(0, 6).join('\n'),
      recovering: this.props.onCrash?.() ?? false,
    });
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.state.recovering) return null;
    return (
      <div className="page">
        <div className="state-box">
          <p>Something went wrong showing this page.</p>
          <pre className="error-detail">
            {String(this.state.error?.message ?? this.state.error)}
            {this.state.stack ? '\n\n' + this.state.stack : ''}
            {recent.length ? '\n\nRecent errors:\n' + recent.join('\n') : ''}
            {`\n\nVersion ${APP_VERSION} · ${navigator.userAgent}`}
          </pre>
          <button className="btn primary" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
