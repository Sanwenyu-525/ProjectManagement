import { useState } from 'react';
import { useThemeStore } from '../../stores/themeStore';
import IntegrationSettings from './IntegrationSettings';
import { GeneralSettings, TerminalSettings, GitToolsSettings, DataManagementSettings, AppearanceSettings, WorkspaceSettings, McpServersSettings, BuildSettings, AgentConfigsSettings, CustomCommandsSettings } from './panels';

// ── Sub-navigation structure ──
const navGroups: Array<{
  title: string;
  items: Array<{ key: string; icon: string; label: string; badge?: string }>;
}> = [
  {
    title: '偏好设置',
    items: [
      { key: 'general', icon: 'tune', label: '通用' },
      { key: 'integrations', icon: 'link', label: '平台集成' },
      { key: 'appearance', icon: 'palette', label: '外观' },
      { key: 'workspace-nav', icon: 'workspaces', label: '工作区' },
    ],
  },
  {
    title: 'AI 与智能体',
    items: [
      { key: 'agent-configs', icon: 'smart_toy', label: 'Agent 配置' },
      { key: 'custom-commands', icon: 'code', label: '自定义命令' },
      { key: 'mcp-servers', icon: 'dns', label: 'MCP 服务器', badge: '测试版' },
    ],
  },
  {
    title: '工具',
    items: [
      { key: 'terminal', icon: 'terminal', label: '终端' },
      { key: 'git-tools', icon: 'account_tree', label: 'Git' },
      { key: 'build', icon: 'build', label: '构建' },
      { key: 'data', icon: 'cloud_download', label: '数据管理' },
    ],
  },
];

// ── Panel registry ──
const panels: Record<string, React.FC> = {
  general: GeneralSettings,
  integrations: IntegrationSettings,
  appearance: AppearanceSettings,
  'workspace-nav': WorkspaceSettings,
  'agent-configs': AgentConfigsSettings,
  'custom-commands': CustomCommandsSettings,
  'mcp-servers': McpServersSettings,
  terminal: TerminalSettings,
  'git-tools': GitToolsSettings,
  build: BuildSettings,
  data: DataManagementSettings,
};

// ── Main Component ──

export default function SettingsPage() {
  const [activeKey, setActiveKey] = useState('general');
  const isDark = useThemeStore(s => s.mode === 'dark');

  const ActivePanel = panels[activeKey] || GeneralSettings;

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Left sub-navigation (260px) */}
      <aside style={{
        width: 260,
        flexShrink: 0,
        padding: '16px 8px',
        overflowY: 'auto',
        borderRight: '1px solid var(--border)',
        background: 'transparent',
      }}>
        {/* Page title */}
        <div style={{
          padding: '8px 12px 16px',
          fontSize: 'var(--text-xl)',
          fontWeight: 600,
          color: 'var(--md-on-surface)',
          letterSpacing: '-0.01em',
        }}>
          设置
        </div>

        {/* Nav groups */}
        {navGroups.map(group => (
          <div key={group.title} style={{ marginBottom: 16 }}>
            <div style={{
              padding: '4px 12px 6px',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--md-on-surface-variant)',
              fontFamily: 'var(--font-label)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              opacity: 0.7,
            }}>
              {group.title}
            </div>
            {group.items.map(item => {
              const isActive = activeKey === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveKey(item.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 12px 8px 10px',
                    border: 'none',
                    borderLeft: isActive ? '2px solid var(--md-primary)' : '2px solid transparent',
                    borderRadius: 8,
                    background: isActive
                      ? 'var(--md-primary-container)'
                      : 'transparent',
                    color: isActive ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-base)',
                    textAlign: 'left',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = isDark ? 'var(--md-surface-container-high)' : 'var(--md-surface-container-high)';
                      e.currentTarget.style.color = 'var(--md-on-surface)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--md-on-surface-variant)';
                    }
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {item.icon}
                  </span>
                  <span style={{ flex: 1, fontWeight: isActive ? 500 : 400 }}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span style={{
                      background: 'var(--md-primary)',
                      color: 'var(--md-on-primary)',
                      fontFamily: 'var(--font-label)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 3,
                      letterSpacing: '0.03em',
                    }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      {/* Right content area */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--layout-container-padding)',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <ActivePanel />
        </div>
      </main>
    </div>
  );
}
