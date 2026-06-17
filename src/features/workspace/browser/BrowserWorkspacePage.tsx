import { useState, useRef, useEffect, useCallback } from 'react';
import { Input, Button, List, Tag, Empty, Spin } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { browserMemoryApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { useThemeStore } from '../../../stores/themeStore';
import type { BrowserVisit } from '../../../types';
import type { CSSProperties } from 'react';

// ─────────────────────────────────────────────────────────────
// Browser Tab Model
// ─────────────────────────────────────────────────────────────

interface BrowserTab {
  id: string;
  title: string;
  url: string;
}

let tabCounter = 0;

function createTab(url = ''): BrowserTab {
  tabCounter += 1;
  return {
    id: `browser-tab-${Date.now()}-${tabCounter}`,
    title: url ? new URL(url).hostname : '新标签页',
    url,
  };
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function BrowserWorkspacePage() {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const queryClient = useQueryClient();

  // ── State ──
  const [tabs, setTabs] = useState<BrowserTab[]>(() => [createTab('about:blank')]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);
  const [addressInput, setAddressInput] = useState('');
  const [historyPanelVisible, setHistoryPanelVisible] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeKeyRef = useRef(0);

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];

  // ── Data ──
  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: queryKeys.browser.visits(),
    queryFn: () => browserMemoryApi.listVisits(undefined, 50),
    refetchInterval: 3000,
  });

  const recordVisit = useMutation({
    mutationFn: (data: { tabId: string; url: string; title?: string }) =>
      browserMemoryApi.recordVisit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.browser.visits() });
    },
  });

  // ── Navigation ──
  const navigate = useCallback((url: string) => {
    if (!url) return;
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && url !== 'about:blank') {
      finalUrl = 'https://' + url;
    }
    const hostname = (() => {
      try { return new URL(finalUrl).hostname; } catch { return finalUrl; }
    })();
    setTabs(prev => prev.map(t =>
      t.id === activeTabId ? { ...t, url: finalUrl, title: hostname || t.title } : t
    ));
    setAddressInput(finalUrl);
    iframeKeyRef.current += 1;
    recordVisit.mutate({ tabId: activeTabId, url: finalUrl, title: hostname });
  }, [activeTabId, recordVisit]);

  // Sync address bar when tab changes
  useEffect(() => {
    if (activeTab) {
      setAddressInput(activeTab.url === 'about:blank' ? '' : activeTab.url);
    }
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab Operations ──
  const addTab = () => {
    const tab = createTab();
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    setAddressInput('');
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return;
    setTabs(prev => {
      const next = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(next[next.length - 1].id);
      }
      return next;
    });
  };

  // ── Styles ──
  const s = styles(isDark);

  return (
    <div style={s.root}>
      {/* ── Main Content ── */}
      <div style={s.main}>

        {/* ── Browser Pane ── */}
        <div style={s.browserPane}>
          {/* Tab Bar */}
          <div style={s.tabBar}>
            {tabs.map(tab => (
              <div
                key={tab.id}
                style={{
                  ...s.tab,
                  ...(tab.id === activeTabId ? s.tabActive : {}),
                }}
                onClick={() => setActiveTabId(tab.id)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-primary)' }}>public</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, maxWidth: 140 }}>
                  {tab.title}
                </span>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 14, cursor: 'pointer', opacity: 0.5, flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                >
                  close
                </span>
              </div>
            ))}
            <div style={s.tabDivider} />
            <button style={s.addTabBtn} onClick={addTab}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            </button>
          </div>

          {/* Address Bar */}
          <div style={s.addressBar}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['arrow_back', 'arrow_forward', 'refresh'].map(icon => (
                <button
                  key={icon}
                  style={s.navBtn}
                  onClick={icon === 'refresh' ? () => navigate(activeTab.url) : undefined}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
                </button>
              ))}
            </div>
            <Input
              value={addressInput}
              onChange={e => setAddressInput(e.target.value)}
              onPressEnter={() => navigate(addressInput)}
              placeholder="输入 URL 并按 Enter 访问"
              prefix={<span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-text-tertiary)' }}>search</span>}
              style={s.addressInput}
              variant="borderless"
            />
            <Button
              type="text"
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>history</span>}
              onClick={() => setHistoryPanelVisible(prev => !prev)}
              style={s.navBtn}
            />
          </div>

          {/* iframe Preview */}
          <div style={s.previewContainer}>
            {activeTab.url && activeTab.url !== 'about:blank' ? (
              <iframe
                key={iframeKeyRef.current}
                ref={iframeRef}
                src={activeTab.url}
                style={s.iframe}
                title={activeTab.title}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
            ) : (
              <div style={s.emptyPreview}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--color-text-muted)', marginBottom: 16 }}>public</span>
                <p style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text-primary)' }}>浏览器工作区</p>
                <p style={{ margin: '8px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>在地址栏输入 URL 开始浏览</p>
              </div>
            )}
          </div>
        </div>

        {/* ── History Panel ── */}
        {historyPanelVisible && (
          <div style={s.historyPanel}>
            <div style={s.historyHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-primary)' }}>history</span>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}>浏览历史</span>
              </div>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
                onClick={() => setHistoryPanelVisible(false)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-text-tertiary)' }}>close</span>
              </button>
            </div>
            <div style={s.historyList}>
              {visitsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spin /></div>
              ) : visits.length === 0 ? (
                <Empty description="暂无浏览记录" style={{ padding: 32 }} />
              ) : (
                <List
                  dataSource={visits}
                  renderItem={(visit: BrowserVisit) => (
                    <List.Item
                      style={s.historyItem}
                      onClick={() => {
                        setAddressInput(visit.url);
                        navigate(visit.url);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary)', marginTop: 2, flexShrink: 0 }}>public</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {visit.title || visit.url}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                            {visit.url}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 6px' }}>
                              {new Date(visit.visitedAt).toLocaleString()}
                            </Tag>
                          </div>
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

function styles(isDark: boolean): Record<string, CSSProperties> {
  return {
    root: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
    },
    main: {
      flex: 1,
      display: 'flex',
      padding: 16,
      gap: 16,
      overflow: 'hidden',
      background: 'var(--md-surface-container)',
    },
    browserPane: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      borderRadius: 12,
      background: 'var(--md-surface-container-lowest)',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.03)',
      border: '1px solid var(--md-outline-variant)',
      overflow: 'hidden',
    },
    tabBar: {
      display: 'flex',
      alignItems: 'center',
      padding: '8px 8px',
      background: 'var(--md-surface-bright)',
      borderBottom: '1px solid var(--md-outline-variant)',
      overflowX: 'auto',
      gap: 4,
    },
    tab: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      minWidth: 120,
      maxWidth: 200,
      flexShrink: 0,
      background: 'transparent',
      border: '1px solid transparent',
      borderRadius: 6,
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
      color: 'var(--color-text-secondary)',
      transition: 'all 0.15s ease',
    },
    tabActive: {
      background: 'var(--md-surface-container-lowest)',
      border: '1px solid var(--md-outline-variant)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      color: 'var(--color-text-primary)',
    },
    tabDivider: {
      width: 1,
      height: 16,
      background: 'var(--md-outline-variant)',
      flexShrink: 0,
      margin: '0 4px',
    },
    addTabBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
      height: 28,
      borderRadius: 6,
      border: 'none',
      background: 'transparent',
      color: 'var(--color-text-tertiary)',
      cursor: 'pointer',
      flexShrink: 0,
      transition: 'all 0.15s ease',
    },
    addressBar: {
      height: 40,
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 8,
      background: 'var(--md-surface-bright)',
      borderBottom: '1px solid var(--md-outline-variant)',
      flexShrink: 0,
    },
    navBtn: {
      color: 'var(--color-text-tertiary)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 4,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addressInput: {
      flex: 1,
      background: 'var(--md-surface-container)',
      borderRadius: 4,
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
    },
    previewContainer: {
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
      background: isDark ? '#0d1117' : '#f9fafb',
    },
    iframe: {
      width: '100%',
      height: '100%',
      border: 'none',
    },
    emptyPreview: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
    },
    historyPanel: {
      width: 320,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 12,
      background: 'var(--md-surface-container-lowest)',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.03)',
      border: '1px solid var(--md-outline-variant)',
      overflow: 'hidden',
    },
    historyHeader: {
      height: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      background: 'var(--md-surface-bright)',
      borderBottom: '1px solid var(--md-outline-variant)',
      flexShrink: 0,
    },
    historyList: {
      flex: 1,
      overflowY: 'auto',
      padding: '8px 0',
    },
    historyItem: {
      padding: '10px 16px',
      cursor: 'pointer',
      transition: 'background 0.15s ease',
    },
  };
}
