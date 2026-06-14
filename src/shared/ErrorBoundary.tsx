import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional fallback UI. If omitted, shows a default error screen. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches rendering errors in child components
 * and displays a fallback UI instead of crashing the entire app.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>⚠</div>
            <h2 style={styles.title}>页面出错了</h2>
            <p style={styles.message}>
              {this.state.error?.message || '组件渲染时发生未知错误'}
            </p>
            <button onClick={this.handleReset} style={styles.button}>
              重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: '#1a1b26',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '32px 48px',
    borderRadius: 12,
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    maxWidth: 400,
  },
  icon: {
    fontSize: 36,
    opacity: 0.6,
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#e2e8f0',
    fontFamily: "'Fira Sans', sans-serif",
  },
  message: {
    margin: 0,
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: "'Fira Code', monospace",
    textAlign: 'center',
    wordBreak: 'break-word',
  },
  button: {
    marginTop: 8,
    padding: '6px 20px',
    borderRadius: 6,
    border: '1px solid rgba(99, 102, 241, 0.3)',
    background: 'rgba(99, 102, 241, 0.1)',
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
};
