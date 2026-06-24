import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import AgentTerminal from './AgentTerminal';
import type { AgentTerminalHandle } from './AgentTerminal';
import AgentGUIPanel from './AgentGUIPanel';
import { useAgentTabStore } from '../../../stores/agentTabStore';

export interface AgentTerminalModeHandle {
  switchCwd: (newCwd: string) => void;
}

interface AgentTerminalModeProps {
  mode: 'xterm' | 'gui';
  tabId: string;
  style?: React.CSSProperties;
}

const AgentTerminalMode = forwardRef<AgentTerminalModeHandle, AgentTerminalModeProps>(
  function AgentTerminalMode({ mode, tabId, style }, ref) {
    const agentTerminalRef = useRef<AgentTerminalHandle>(null);
    const tabCwd = useAgentTabStore(s => s.tabs.find(t => t.id === tabId)?.cwd ?? null);

    const switchCwd = useCallback((newCwd: string) => {
      agentTerminalRef.current?.switchCwd(newCwd);
    }, []);

    useImperativeHandle(ref, () => ({ switchCwd }), [switchCwd]);

    if (mode === 'gui') {
      return <AgentGUIPanel tabId={tabId} cwd={tabCwd ?? undefined} style={style} />;
    }

    return <AgentTerminal ref={agentTerminalRef} tabId={tabId} style={style} />;
  }
);

export default AgentTerminalMode;
