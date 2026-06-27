import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
    this.props.onError?.(error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 8,
          color: 'var(--md-on-surface-variant)', fontSize: 12, padding: 16,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-error)' }}>
            error
          </span>
          <span>组件渲染出错</span>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--md-surface-container-low)', cursor: 'pointer', fontSize: 12,
            }}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
