import { useCallback, useRef, useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { terminalApi, screenshotApi, browserMemoryApi } from '../../api';
import BrowserToolbar from './BrowserToolbar';
import BrowserDevTools from './BrowserDevTools';
import { getBrowserAdapter } from './browser';
import type { BrowserEvent } from './browser/types';

interface Props {
  tabId: string;
}

interface InspectedElement {
  tag: string;
  id: string | null;
  className: string | null;
  text: string;
  html: string;
  x: number;
  y: number;
  width: number;
  height: number;
  childCount: number;
}

// ── Helpers ──

interface ScenarioStepResult {
  index: number;
  action: string;
  pass: boolean;
  label: string;
  detail?: string;
  duration: number;
}

interface ScenarioResult {
  label: string;
  steps: ScenarioStepResult[];
  passed: number;
  failed: number;
  total: number;
  duration: number;
}

function formatScenarioResult(sr: ScenarioResult): string {
  const lines = [`[scenario] 测试: ${sr.label} (${sr.passed}/${sr.total} 通过)`];
  sr.steps.forEach((step, i) => {
    const icon = step.pass ? '✅' : '❌';
    const timeStr = step.duration > 1000 ? ` [${step.duration}ms]` : '';
    lines.push(`  ${icon} ${i + 1}. ${step.label}${timeStr}`);
    if (!step.pass && step.detail) lines.push(`     ↳ ${step.detail}`);
  });
  lines.push(`  耗时: ${(sr.duration / 1000).toFixed(1)}s`);
  return lines.join('\n');
}

function sendToAgent(prompt: string) {
  const tabs = useWorkspaceStore.getState().tabs;
  const agents = Object.values(tabs).filter(t => t.contentType === 'agent');
  for (const agent of agents) {
    terminalApi.input(agent.id, prompt).catch(() => {});
  }
}

function formatDomAnalysis(a: Record<string, unknown>): string {
  const parts: string[] = [];
  if (a.title) parts.push(`Title: ${a.title}`);
  if (a.url) parts.push(`URL: ${a.url}`);
  if (Array.isArray(a.headings) && a.headings.length) parts.push(`Headings: ${a.headings.join(' | ')}`);
  if (Array.isArray(a.buttons) && a.buttons.length) parts.push(`Buttons: ${a.buttons.join(', ')}`);
  if (Array.isArray(a.inputs) && a.inputs.length) {
    parts.push(`Inputs: ${(a.inputs as { type: string; name: string; placeholder: string }[]).map(i => `${i.type}${i.name ? '(' + i.name + ')' : ''}${i.placeholder ? ' "' + i.placeholder + '"' : ''}`).join(', ')}`);
  }
  if (Array.isArray(a.forms) && a.forms.length) parts.push(`Forms: ${(a.forms as { action: string; fields: number }[]).map(f => `${f.action}(${f.fields} fields)`).join(', ')}`);
  if (Array.isArray(a.images) && a.images.length) parts.push(`Images: ${a.images.length}`);
  if (a.bodySize) parts.push(`DOM size: ${a.bodySize} chars`);
  if (a.textPreview) parts.push(`Text: ${String(a.textPreview).substring(0, 200)}`);
  return parts.join('\n');
}

// ── Component ──

export default function BrowserPane({ tabId }: Props) {
  const tab = useWorkspaceStore(s => s.tabs[tabId]);
  const updateBrowserUrl = useWorkspaceStore(s => s.updateBrowserUrl);
  const pushConsoleLog = useWorkspaceStore(s => s.pushConsoleLog);
  const pushNetworkRequest = useWorkspaceStore(s => s.pushNetworkRequest);
  const clearBrowserLogs = useWorkspaceStore(s => s.clearBrowserLogs);
  const setBrowserActivePanel = useWorkspaceStore(s => s.setBrowserActivePanel);
  const setBrowserAutomation = useWorkspaceStore(s => s.setBrowserAutomation);
  const browserPanelState = useWorkspaceStore(s => s.browserPanelState);
  const logs = useWorkspaceStore(s => s.browserLogs[tabId]);
  const containerRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);
  const [inspectMode, setInspectMode] = useState(false);
  const [inspectedElement, setInspectedElement] = useState<InspectedElement | null>(null);
  const inspectedRef = useRef<InspectedElement | null>(null);
  inspectedRef.current = inspectedElement;
  const screenshotCallbackRef = useRef<((analysis: Record<string, unknown> | null, error?: string) => void) | null>(null);
  // Message authentication token — passed to adapter for postMessage verification
  const authTokenRef = useRef(crypto.randomUUID());

  const url = tab && 'url' in tab ? tab.url : undefined;
  const history = tab && 'urlHistory' in tab ? tab.urlHistory || [] : [];
  const idx = tab && 'urlHistoryIndex' in tab ? (tab.urlHistoryIndex ?? -1) : -1;
  const activePanel = browserPanelState[tabId] || 'none';
  const consoleLogs = logs?.consoleLogs || [];
  const networkRequests = logs?.networkRequests || [];

  const errorCount = consoleLogs.filter(l => l.method === 'error').length;

  // Mount adapter into container
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !url) return;

    const adapter = getBrowserAdapter();
    adapter.mount(tabId, url, container, { authToken: authTokenRef.current });
    return () => adapter.unmount(tabId);
  }, [tabId, url]);

  // Subscribe to adapter events
  useEffect(() => {
    const adapter = getBrowserAdapter();
    const unsubscribe = adapter.onEvent((event: BrowserEvent) => {
      if (event.tabId !== tabId) return;
      const { type, payload } = event;

      if (type === 'console') {
        pushConsoleLog(tabId, {
          id: logIdRef.current++,
          method: payload.method as 'error' | 'log' | 'warn',
          args: payload.args as string[],
          timestamp: Date.now(),
        });
      } else if (type === 'network') {
        pushNetworkRequest(tabId, {
          id: logIdRef.current++,
          method: payload.method as string,
          url: payload.url as string,
          status: payload.status as number,
          duration: payload.duration as number,
          timestamp: Date.now(),
        });
      } else if (type === 'inspect') {
        setInspectedElement(payload as unknown as InspectedElement);
      } else if (type === 'result') {
        handleBrowserResult(payload);
      } else if (type === 'screenshot-request') {
        handleScreenshotRequest();
      }
    });
    return unsubscribe;
  }, [tabId, pushConsoleLog, pushNetworkRequest, setBrowserAutomation]);

  const handleBrowserResult = useCallback((r: Record<string, unknown>) => {
    // Screenshot results go through the ref callback
    if (r.action === 'screenshot' && screenshotCallbackRef.current) {
      screenshotCallbackRef.current(r.ok ? r.analysis as Record<string, unknown> : null, r.error as string);
      screenshotCallbackRef.current = null;
      return;
    }

    let resultText: string;
    if (r.scenarioResult) {
      const sr = r.scenarioResult as ScenarioResult;
      resultText = formatScenarioResult(sr);
      useWorkspaceStore.getState().addTestReport({
        id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: sr.label,
        browserTabId: tabId,
        timestamp: Date.now(),
        steps: sr.steps,
        summary: { passed: sr.passed, failed: sr.failed, total: sr.total, duration: sr.duration },
      });
    } else if (r.verifyResult) {
      const v = r.verifyResult as { pass: boolean; detail: string };
      resultText = v.pass
        ? `[verify] ✅ ${v.detail}`
        : `[verify] ❌ ${v.detail}`;
    } else if (r.analysis) {
      resultText = formatDomAnalysis(r.analysis as Record<string, unknown>);
      // Cache DOM analysis to browser memory (best-effort)
      browserMemoryApi.recordVisit({
        tabId,
        url: url || '',
        domAnalysis: resultText,
      }).catch(() => {});
    } else if (r.ok) {
      resultText = `[browser] ${r.action || 'ok'}${r.found ? ' — found' : ''}${r.value ? ' → ' + r.value : ''}${r.text ? ' — ' + (r.text as string).substring(0, 80) : ''}`;
    } else {
      resultText = `[browser] Error: ${r.error}`;
    }
    setBrowserAutomation(tabId, { status: 'idle', lastResult: resultText });
    sendToAgent(resultText);
  }, [tabId, url, setBrowserAutomation]);

  const handleScreenshotRequest = useCallback(() => {
    setBrowserAutomation(tabId, { status: 'running', lastResult: '' });
    screenshotApi.captureMain().then(result => {
      const msg = result
        ? `[screenshot] ✅ Saved to ${result.path}`
        : `[screenshot] ❌ No DevHub window found`;
      setBrowserAutomation(tabId, { status: 'idle', lastResult: msg });
      sendToAgent(msg);
    }).catch(err => {
      const msg = `[screenshot] ❌ ${err}`;
      setBrowserAutomation(tabId, { status: 'idle', lastResult: msg });
      sendToAgent(msg);
    });
  }, [tabId, setBrowserAutomation]);

  const handleNavigate = useCallback((newUrl: string) => {
    const adapter = getBrowserAdapter();
    adapter.navigate(tabId, newUrl);
    updateBrowserUrl(tabId, newUrl);
    clearBrowserLogs(tabId);
    // Record browser visit (best-effort)
    browserMemoryApi.recordVisit({ tabId, url: newUrl }).catch(() => {});
  }, [tabId, updateBrowserUrl, clearBrowserLogs]);

  const handleBack = useCallback(() => {
    const newIdx = idx - 1;
    if (newIdx >= 0 && history[newIdx]) {
      handleNavigate(history[newIdx]);
      useWorkspaceStore.getState().goBack(tabId);
    }
  }, [tabId, idx, history, handleNavigate]);

  const handleForward = useCallback(() => {
    const newIdx = idx + 1;
    if (newIdx < history.length) {
      handleNavigate(history[newIdx]);
      useWorkspaceStore.getState().goForward(tabId);
    }
  }, [tabId, idx, history, handleNavigate]);

  const handleReload = useCallback(() => {
    clearBrowserLogs(tabId);
    if (url) {
      const adapter = getBrowserAdapter();
      adapter.navigate(tabId, url);
    }
  }, [tabId, url, clearBrowserLogs]);

  const handleTogglePanel = useCallback((panel: 'none' | 'console' | 'network') => {
    setBrowserActivePanel(tabId, panel);
  }, [tabId, setBrowserActivePanel]);

  const handleClearLogs = useCallback(() => {
    clearBrowserLogs(tabId);
  }, [tabId, clearBrowserLogs]);

  const disableInspectMode = useCallback(() => {
    setInspectedElement(null);
    setInspectMode(false);
    getBrowserAdapter().setInspectMode(tabId, false);
  }, [tabId]);

  const handleToggleInspect = useCallback(() => {
    setInspectMode(prev => {
      const next = !prev;
      getBrowserAdapter().setInspectMode(tabId, next);
      if (!next) setInspectedElement(null);
      return next;
    });
  }, [tabId]);

  const handleSendToAgent = useCallback(() => {
    const el = inspectedRef.current;
    if (!el) return;
    const lines = [
      `检查此浏览器元素并修复：`,
      `标签：<${el.tag}>`,
      el.id ? `ID：${el.id}` : null,
      el.className ? `类名：${el.className}` : null,
      el.text ? `文本内容：${el.text}` : null,
      `尺寸：${el.width}x${el.height} at (${el.x}, ${el.y})`,
      `子元素数：${el.childCount}`,
      ``,
      `页面 URL：${url || '未知'}`,
    ].filter(Boolean).join('\n');
    sendToAgent(lines);
    disableInspectMode();
  }, [url, disableInspectMode]);

  const handleSendError = useCallback((error: string) => {
    sendToAgent(`修复此浏览器错误：\n${error}`);
  }, []);

  const handleScreenshot = useCallback(() => {
    screenshotCallbackRef.current = (analysis, error) => {
      if (error) {
        console.error('Screenshot failed:', error);
        return;
      }
      const text = analysis ? formatDomAnalysis(analysis) : 'No analysis available';
      sendToAgent(`浏览器截图分析（当前页面：${url || '未知'}）：\n${text}`);
    };
    getBrowserAdapter().requestScreenshot(tabId);
  }, [tabId, url]);

  if (!tab) return null;

  return (
    <div style={styles.container}>
      <BrowserToolbar
        url={url}
        canGoBack={idx > 0}
        canGoForward={idx < history.length - 1}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        onScreenshot={handleScreenshot}
        inspectMode={inspectMode}
        onToggleInspect={handleToggleInspect}
        errorCount={errorCount}
        networkCount={networkRequests.length}
        activePanel={activePanel}
        onTogglePanel={handleTogglePanel}
      />
      {inspectedElement && (
        <div style={styles.inspectPanel}>
          <div style={styles.inspectInfo}>
            <span style={styles.inspectTag}>&lt;{inspectedElement.tag}&gt;</span>
            {inspectedElement.id && <span style={styles.inspectDetail}>#{inspectedElement.id}</span>}
            {inspectedElement.className && <span style={styles.inspectDetail}>.{String(inspectedElement.className).split(' ').slice(0, 2).join('.')}</span>}
            <span style={styles.inspectSize}>{inspectedElement.width}×{inspectedElement.height}</span>
            {inspectedElement.text && <span style={styles.inspectText}>"{inspectedElement.text}"</span>}
          </div>
          <div style={styles.inspectActions}>
            <button onClick={handleSendToAgent} style={styles.inspectSendBtn} title="发送给 Agent">
              🤖 交给 Agent
            </button>
            <button onClick={disableInspectMode} style={styles.inspectCloseBtn}>
              ✕
            </button>
          </div>
        </div>
      )}
      <div style={styles.mainArea}>
        {url ? (
          <div ref={containerRef} style={styles.adapterContainer} />
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🌐</div>
            <div style={styles.emptyText}>输入 URL 或从 Navigator 中选择 Preview</div>
          </div>
        )}
      </div>
      {activePanel !== 'none' && (
        <div style={styles.devtoolsArea}>
          <BrowserDevTools
            consoleLogs={activePanel === 'console' ? consoleLogs : []}
            networkRequests={activePanel === 'network' ? networkRequests : []}
            onClearConsole={handleClearLogs}
            onClearNetwork={handleClearLogs}
            onSendError={handleSendError}
          />
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
  },
  mainArea: {
    flex: 1,
    overflow: 'hidden',
    background: '#1a1b26',
    minHeight: 0,
  },
  adapterContainer: {
    width: '100%',
    height: '100%',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
    opacity: 0.3,
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
  },
  devtoolsArea: {
    height: 200,
    flexShrink: 0,
    overflow: 'hidden',
  },
  inspectPanel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
    padding: '0 10px',
    background: 'rgba(99, 102, 241, 0.08)',
    borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
    flexShrink: 0,
    gap: 8,
  },
  inspectInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    flex: 1,
    minWidth: 0,
  },
  inspectTag: {
    fontSize: 11,
    fontWeight: 600,
    color: '#a5b4fc',
    fontFamily: "'Fira Code', monospace",
    flexShrink: 0,
  },
  inspectDetail: {
    fontSize: 10,
    color: '#818cf8',
    fontFamily: "'Fira Code', monospace",
    flexShrink: 0,
  },
  inspectSize: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: "'Fira Code', monospace",
    flexShrink: 0,
  },
  inspectText: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: "'Fira Code', monospace",
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  inspectActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  inspectSendBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 4,
    border: 'none',
    background: 'rgba(99, 102, 241, 0.2)',
    color: '#a5b4fc',
    fontSize: 10,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  inspectCloseBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: 3,
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    padding: 0,
  },
};
