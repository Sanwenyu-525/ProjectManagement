/**
 * Iframe-based browser adapter.
 *
 * Wraps the existing iframe + postMessage automation approach.
 * Renders an iframe into a container, injects scripts for devtools/inspect/automation,
 * and routes commands via postMessage.
 */
import type { BrowserAdapter, BrowserCommand, BrowserEvent, AdapterMountOptions } from './types';
import { AUTOMATION_SCRIPT } from '../browserAutomationScript';

// ── Injected scripts ──

const DEVTOOLS_SCRIPT = `
(function(){
  if(window.__dh_injected) return;
  window.__dh_injected=true;
  var AUTH_TOKEN='__AUTH_TOKEN__';
  function send(t,d){window.parent.postMessage(Object.assign({_auth:AUTH_TOKEN,type:t},d),'*')}
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

const INSPECT_SCRIPT = `
(function(){
  if(window.__dh_inspect_injected) return;
  window.__dh_inspect_injected=true;
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;pointer-events:none;z-index:999999;border:2px dashed #6366f1;background:rgba(99,102,241,0.08);display:none';
  document.body.appendChild(overlay);
  var style=document.createElement('style');
  style.textContent='body.__dh-inspect *{cursor:crosshair!important}';
  document.head.appendChild(style);
  var active=false;
  var AUTH_TOKEN='__AUTH_TOKEN__';
  function send(t,d){window.parent.postMessage(Object.assign({_auth:AUTH_TOKEN,type:t},d),'*')}
  window.addEventListener('message',function(e){
    if(e.data&&e.data.type==='devhub-set-inspect-mode'){
      active=e.data.active;
      overlay.style.display=active?'block':'none';
      if(active){document.body.classList.add('__dh-inspect')}
      else{document.body.classList.remove('__dh-inspect')}
    }
  });
  document.addEventListener('mouseover',function(e){
    if(!active)return;
    var r=e.target.getBoundingClientRect();
    overlay.style.left=r.left+'px';overlay.style.top=r.top+'px';
    overlay.style.width=r.width+'px';overlay.style.height=r.height+'px';
  },true);
  document.addEventListener('click',function(e){
    if(!active)return;
    e.preventDefault();e.stopPropagation();
    var el=e.target;var r=el.getBoundingClientRect();
    send('devhub-inspect',{
      tag:el.tagName,id:el.id||null,className:el.className||null,
      text:(el.innerText||'').substring(0,100),
      html:el.outerHTML.substring(0,200),
      x:Math.round(r.left),y:Math.round(r.top),
      width:Math.round(r.width),height:Math.round(r.height),
      childCount:el.children.length
    });
    active=false;overlay.style.display='none';
    document.body.classList.remove('__dh-inspect');
  },true);
})();
`;

// ── Adapter implementation ──

interface TabState {
  iframe: HTMLIFrameElement;
  container: HTMLElement;
  authToken: string;
  url: string;
  messageHandler: ((e: MessageEvent) => void) | null;
}

export class IframeAdapter implements BrowserAdapter {
  readonly id = 'iframe';
  readonly label = 'Iframe';
  readonly capabilities = {
    automation: true,
    consoleCapture: true,
    networkCapture: true,
    inspect: true,
    crossOrigin: false,
  };

  private tabs = new Map<string, TabState>();
  private listeners: Array<(event: BrowserEvent) => void> = [];

  onEvent(callback: (event: BrowserEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private emit(event: BrowserEvent) {
    for (const listener of this.listeners) listener(event);
  }

  mount(tabId: string, url: string, container: HTMLElement, options: AdapterMountOptions): void {
    // Clean up existing iframe for this tab if any
    this.unmount(tabId);

    const iframe = document.createElement('iframe');
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.title = tabId;

    container.appendChild(iframe);

    const state: TabState = { iframe, container, authToken: options.authToken, url, messageHandler: null };
    this.tabs.set(tabId, state);

    // Set up message listener for this iframe
    const handler = (e: MessageEvent) => {
      if (e.data?._auth !== state.authToken) return;
      this.handleIframeMessage(tabId, e.data);
    };
    state.messageHandler = handler;
    window.addEventListener('message', handler);

    // Navigate and inject scripts on load
    if (url) {
      iframe.src = url;
      iframe.onload = () => this.injectScripts(tabId);
    }
  }

  unmount(tabId: string): void {
    const state = this.tabs.get(tabId);
    if (!state) return;

    // Remove message listener
    if (state.messageHandler) {
      window.removeEventListener('message', state.messageHandler);
    }

    // Remove iframe from DOM
    state.iframe.remove();
    this.tabs.delete(tabId);
  }

  executeCommand(tabId: string, command: BrowserCommand): void {
    const state = this.tabs.get(tabId);
    if (!state?.iframe.contentWindow) return;

    state.iframe.contentWindow.postMessage(
      { type: 'devhub-browser-command', ...command },
      '*',
    );
  }

  navigate(tabId: string, url: string): void {
    const state = this.tabs.get(tabId);
    if (!state) return;
    state.url = url;
    state.iframe.src = url;
    state.iframe.onload = () => this.injectScripts(tabId);
  }

  setInspectMode(tabId: string, active: boolean): void {
    const state = this.tabs.get(tabId);
    if (!state?.iframe.contentWindow) return;
    state.iframe.contentWindow.postMessage(
      { _auth: state.authToken, type: 'devhub-set-inspect-mode', active },
      '*',
    );
  }

  requestScreenshot(tabId: string): void {
    const state = this.tabs.get(tabId);
    if (!state?.iframe.contentWindow) return;
    state.iframe.contentWindow.postMessage(
      { _auth: state.authToken, type: 'devhub-browser-command', id: Date.now(), action: 'screenshot' },
      '*',
    );
  }

  /** Get the iframe element for a tab (used by BrowserPane for reload) */
  getIframe(tabId: string): HTMLIFrameElement | undefined {
    return this.tabs.get(tabId)?.iframe;
  }

  // ── Internal ──

  private injectScripts(tabId: string): void {
    const state = this.tabs.get(tabId);
    if (!state) return;
    try {
      const doc = state.iframe.contentDocument;
      if (!doc) return;
      const token = state.authToken;

      const s1 = doc.createElement('script');
      s1.textContent = DEVTOOLS_SCRIPT.replace(/__AUTH_TOKEN__/g, token);
      doc.head.appendChild(s1);

      const s2 = doc.createElement('script');
      s2.textContent = INSPECT_SCRIPT.replace(/__AUTH_TOKEN__/g, token);
      doc.head.appendChild(s2);

      const s3 = doc.createElement('script');
      s3.textContent = AUTOMATION_SCRIPT.replace(/__AUTH_TOKEN__/g, token);
      doc.head.appendChild(s3);
    } catch {
      // Cross-origin — silently ignore
    }
  }

  private handleIframeMessage(tabId: string, data: Record<string, unknown>): void {
    if (data.type === 'devhub-console') {
      this.emit({ type: 'console', tabId, payload: data });
    } else if (data.type === 'devhub-network') {
      this.emit({ type: 'network', tabId, payload: data });
    } else if (data.type === 'devhub-inspect') {
      this.emit({ type: 'inspect', tabId, payload: data });
    } else if (data.type === 'devhub-browser-result') {
      this.emit({ type: 'result', tabId, payload: data });
    } else if (data.type === 'devhub-screenshot-request') {
      this.emit({ type: 'screenshot-request', tabId, payload: data });
    }
  }
}
