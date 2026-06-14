import { useEffect, useRef } from 'react';
import type { PluginTab } from './types';

interface Props {
  tab: PluginTab;
}

/**
 * Plugin content pane — renders a plugin's UI based on its pluginId.
 *
 * Plugins are loaded dynamically and rendered in an iframe sandbox.
 * Each plugin has its own isolated state managed by pluginState.
 *
 * Supported built-in plugins (phase 1):
 *   - markdown-editor: Render markdown with live preview
 *   - json-viewer: Format and display JSON data
 *   - database-browser: Browse SQLite tables
 *
 * Future: Plugin registry loaded from filesystem/API.
 */
export default function PluginPane({ tab }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Plugin rendering will be implemented when plugin loader is added
  }, [tab.pluginId, tab.pluginState]);

  return (
    <div ref={containerRef} style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>🧩</div>
        <div style={styles.title}>插件: {tab.pluginId}</div>
        <div style={styles.hint}>
          {tab.pluginState
            ? `状态: ${Object.keys(tab.pluginState).length} 个字段`
            : '插件加载器即将接入'}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: 'var(--ws-content-bg)',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: 24,
    borderRadius: 12,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--ws-border-subtle)',
  },
  icon: {
    fontSize: 32,
    opacity: 0.6,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ws-text)',
    fontFamily: "'Fira Sans', sans-serif",
  },
  hint: {
    fontSize: 11,
    color: 'var(--ws-text-muted)',
    fontFamily: "'Fira Code', monospace",
  },
};
