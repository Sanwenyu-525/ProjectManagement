import { useState, useCallback } from 'react';
import { usePreviewStore } from '../../../stores/previewStore';

export default function PreviewPane() {
  const previews = usePreviewStore(s => s.previews);
  const [urlInput, setUrlInput] = useState('');
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);

  const detectedPreview = selectedPreviewUrl
    ? previews.find(p => p.url === selectedPreviewUrl) || { url: selectedPreviewUrl, label: 'Manual' }
    : previews.length > 0 ? previews[previews.length - 1] : null;

  const handleAddUrl = useCallback(() => {
    const url = urlInput.trim();
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `http://${url}`;
    usePreviewStore.getState().addPreview(fullUrl, 'manual');
    setSelectedPreviewUrl(fullUrl);
    setUrlInput('');
  }, [urlInput]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Preview toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.tabs}>
          {previews.map(p => (
            <button
              key={p.url}
              onClick={() => setSelectedPreviewUrl(p.url)}
              style={{
                ...styles.tab,
                ...(p.url === detectedPreview?.url ? styles.tabActive : {}),
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={styles.urlInputWrap}>
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddUrl(); }}
            placeholder="http://localhost:3000"
            style={styles.urlInput}
          />
          <button onClick={handleAddUrl} style={styles.addBtn} title="打开 URL">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
          </button>
        </div>
      </div>
      {/* Preview content */}
      {detectedPreview ? (
        <iframe
          src={detectedPreview.url}
          style={styles.iframe}
          title="Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : (
        <div style={styles.empty}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--md-outline-variant)', marginBottom: 8 }}>
            language
          </span>
          <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
            启动 dev server 或输入 URL 来预览
          </span>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    background: 'var(--md-surface-container-lowest)',
  },
  tabs: {
    display: 'flex',
    gap: 4,
    flex: 1,
    overflow: 'auto',
  },
  tab: {
    padding: '3px 10px',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: 'var(--md-on-surface-variant)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: 'var(--md-surface-container)',
    color: 'var(--md-on-surface)',
  },
  urlInputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  urlInput: {
    width: 200,
    padding: '3px 8px',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    background: 'var(--md-surface-container-lowest)',
    color: 'var(--md-on-surface)',
    outline: 'none',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--md-on-surface-variant)',
    cursor: 'pointer',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    background: 'var(--md-surface-container-lowest)',
    flex: 1,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    color: 'var(--md-on-surface-variant)',
  },
};
