import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import BrowserToolbar from './BrowserToolbar';
import BrowserDevTools, { ConsoleEntry, NetworkEntry } from './BrowserDevTools';

interface Props {
  tabId: string;
}

// Combined script injected into iframe to capture console + network
const DEVTOOLS_SCRIPT = `
(function(){
  if(window.__dh_injected) return;
  window.__dh_injected=true;
  function send(t,d){window.parent.postMessage(Object.assign({type:t},d),'*')}
  ['error','warn','log'].forEach(function(m){
    var o=console[m];
    console[m]=function(){
      o.apply(console,arguments);
      send('devhub-console',{method:m,args:Array.from(arguments).map(function(a){
        try{return typeof a==='string'?a:JSON.stringify(a)}catch(e){return String(a)}
      })});
    };
  });
  var origFetch=window.fetch;
  window.fetch=function(){
    var url=typeof arguments[0]==='string'?arguments[0]:arguments[0].url||'';
    var method=(arguments[1]&&arguments[1].method)||'GET';
    var start=Date.now();
    return origFetch.apply(this,arguments).then(function(res){
      send('devhub-network',{method:method,url:url,status:res.status,duration:Date.now()-start});
      return res;
    });
  };
  var origOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){
    this._dhMethod=m;this._dhUrl=u;this._dhStart=Date.now();
    this.addEventListener('load',function(){
      send('devhub-network',{method:this._dhMethod,url:this._dhUrl,status:this.status,duration:Date.now()-this._dhStart});
    });
    return origOpen.apply(this,arguments);
  };
})();
`;

export default function BrowserPane({ tabId }: Props) {
  const tab = useWorkspaceStore(s => s.tabs[tabId]);
  const updateBrowserUrl = useWorkspaceStore(s => s.updateBrowserUrl);
  const goBack = useWorkspaceStore(s => s.goBack);
  const goForward = useWorkspaceStore(s => s.goForward);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkEntry[]>([]);
  const [activePanel, setActivePanel] = useState<'none' | 'console' | 'network'>('none');
  const logIdRef = useRef(0);

  const url = tab?.url;
  const history = tab?.urlHistory || [];
  const idx = tab?.urlHistoryIndex ?? -1;

  const errorCount = useMemo(() => consoleLogs.filter(l => l.method === 'error').length, [consoleLogs]);

  // Listen for messages from injected scripts
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'devhub-console') {
        setConsoleLogs(prev => [...prev, {
          id: logIdRef.current++,
          method: e.data.method,
          args: e.data.args,
          timestamp: Date.now(),
        }]);
      } else if (e.data?.type === 'devhub-network') {
        setNetworkRequests(prev => [...prev, {
          id: logIdRef.current++,
          method: e.data.method,
          url: e.data.url,
          status: e.data.status,
          duration: e.data.duration,
          timestamp: Date.now(),
        }]);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Inject scripts when iframe loads (dedup guard inside script)
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const s = doc.createElement('script');
      s.textContent = DEVTOOLS_SCRIPT;
      doc.head.appendChild(s);
    } catch {
      // Cross-origin or sandbox restriction — silently ignore
    }
  }, []);

  const handleNavigate = useCallback((newUrl: string) => {
    updateBrowserUrl(tabId, newUrl);
    setConsoleLogs([]);
    setNetworkRequests([]);
  }, [tabId, updateBrowserUrl]);

  const handleBack = useCallback(() => goBack(tabId), [tabId, goBack]);
  const handleForward = useCallback(() => goForward(tabId), [tabId, goForward]);
  const handleReload = useCallback(() => {
    setConsoleLogs([]);
    setNetworkRequests([]);
    if (iframeRef.current && url) {
      iframeRef.current.src = url;
    }
  }, [url]);

  const handleClearConsole = useCallback(() => setConsoleLogs([]), []);
  const handleClearNetwork = useCallback(() => setNetworkRequests([]), []);

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
        errorCount={errorCount}
        networkCount={networkRequests.length}
        activePanel={activePanel}
        onTogglePanel={setActivePanel}
      />
      <div style={styles.mainArea}>
        {url ? (
          <iframe
            ref={iframeRef}
            src={url}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            style={styles.iframe}
            title={tab.label}
            onLoad={handleIframeLoad}
          />
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
            onClearConsole={handleClearConsole}
            onClearNetwork={handleClearNetwork}
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
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
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
};
