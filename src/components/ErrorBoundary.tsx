import { Component, type ReactNode } from 'react';

// Keeps a crash in one page from blanking the whole app, and shows the error
// so it can be reported.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Page crashed:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <div className="state-box">
          <p>Something went wrong showing this page.</p>
          <pre className="error-detail">{String(this.state.error?.message ?? this.state.error)}</pre>
          <button className="btn primary" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
