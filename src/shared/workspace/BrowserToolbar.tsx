import { useState, useRef, useEffect } from 'react';
import { LeftOutlined, RightOutlined, ReloadOutlined, ExportOutlined, CodeOutlined, ApiOutlined, CameraOutlined, SearchOutlined } from '@ant-design/icons';
import { open } from '@tauri-apps/plugin-shell';
import { isEnterCommit } from '@/lib/keyboard';

interface Props {
  url?: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onScreenshot?: () => void;
  inspectMode?: boolean;
  onToggleInspect?: () => void;
  errorCount?: number;
  networkCount?: number;
  activePanel: 'none' | 'console' | 'network';
  onTogglePanel: (panel: 'none' | 'console' | 'network') => void;
}

export default function BrowserToolbar({
  url, canGoBack, canGoForward,
  onNavigate, onBack, onForward, onReload, onScreenshot,
  inspectMode = false, onToggleInspect,
  errorCount = 0, networkCount = 0,
  activePanel, onTogglePanel,
}: Props) {
  const [inputValue, setInputValue] = useState(url || '');
  const lastExternalUrl = useRef(url);

  useEffect(() => {
    if (url !== undefined && url !== lastExternalUrl.current) {
      lastExternalUrl.current = url;
      setInputValue(url);
    }
  }, [url]);

  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const finalUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `http://${trimmed}`;
    onNavigate(finalUrl);
  };

  return (
    <div style={styles.toolbar}>
      <button onClick={onBack} disabled={!canGoBack} style={{ ...styles.navBtn, opacity: canGoBack ? 1 : 0.3 }} title="后退">
        <LeftOutlined style={styles.navIcon} />
      </button>
      <button onClick={onForward} disabled={!canGoForward} style={{ ...styles.navBtn, opacity: canGoForward ? 1 : 0.3 }} title="前进">
        <RightOutlined style={styles.navIcon} />
      </button>
      <button onClick={onReload} style={styles.navBtn} title="刷新">
        <ReloadOutlined style={styles.navIcon} />
      </button>
      {url && (
        <>
          <button onClick={() => open(url)} style={styles.navBtn} title="在外部浏览器中打开">
            <ExportOutlined style={styles.navIcon} />
          </button>
          {onScreenshot && (
            <button onClick={onScreenshot} style={styles.navBtn} title="截图发送给 Agent">
              <CameraOutlined style={styles.navIcon} />
            </button>
          )}
          {onToggleInspect && (
            <button
              onClick={onToggleInspect}
              style={{ ...styles.navBtn, ...(inspectMode ? styles.navBtnActive : {}) }}
              title="检查元素"
            >
              <SearchOutlined style={styles.navIcon} />
            </button>
          )}
        </>
      )}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => { if (isEnterCommit(e)) handleSubmit(); }}
        placeholder="输入 URL（如 localhost:5173）"
        style={styles.urlInput}
      />
      <div style={styles.devtoolsGroup}>
        <button
          onClick={() => onTogglePanel(activePanel === 'console' ? 'none' : 'console')}
          style={{
            ...styles.navBtn,
            ...(activePanel === 'console' ? styles.navBtnActive : {}),
          }}
          title="Console"
        >
          <CodeOutlined style={styles.navIcon} />
          {errorCount > 0 && <span style={styles.errorDot} />}
        </button>
        <button
          onClick={() => onTogglePanel(activePanel === 'network' ? 'none' : 'network')}
          style={{
            ...styles.navBtn,
            ...(activePanel === 'network' ? styles.navBtnActive : {}),
          }}
          title="Network"
        >
          <ApiOutlined style={styles.navIcon} />
          {networkCount > 0 && <span style={styles.countDot} />}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    height: 32,
    background: 'rgba(255, 255, 255, 0.03)',
    borderBottom: '1px solid var(--ws-border-subtle)',
    padding: '0 8px',
    gap: 4,
    flexShrink: 0,
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 5,
    border: 'none',
    background: 'transparent',
    color: 'var(--ws-text-secondary)',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    position: 'relative',
  },
  navBtnActive: {
    background: 'var(--ws-border)',
    color: 'var(--ws-text)',
  },
  navIcon: {
    fontSize: 10,
  },
  urlInput: {
    flex: 1,
    height: 24,
    background: 'var(--ws-border-subtle)',
    border: '1px solid var(--ws-border)',
    borderRadius: 4,
    color: 'var(--ws-text)',
    fontSize: 11,
    fontFamily: "'Fira Code', monospace",
    padding: '0 8px',
    outline: 'none',
  },
  devtoolsGroup: {
    display: 'flex',
    gap: 2,
    marginLeft: 4,
    flexShrink: 0,
  },
  errorDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: 'var(--color-status-cancel)',
  },
  countDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: 'var(--color-info)',
  },
};
