import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import AgentTerminal from './AgentTerminal';
import type { AgentTerminalHandle } from './AgentTerminal';
import AgentGUIPanel from './AgentGUIPanel';

export interface AgentTerminalModeHandle {
  switchCwd: (newCwd: string) => void;
}

interface AgentTerminalModeProps {
  mode: 'xterm' | 'gui';
}

const AgentTerminalMode = forwardRef<AgentTerminalModeHandle, AgentTerminalModeProps>(
  function AgentTerminalMode({ mode }, ref) {
    const agentTerminalRef = useRef<AgentTerminalHandle>(null);

    const switchCwd = useCallback((newCwd: string) => {
      agentTerminalRef.current?.switchCwd(newCwd);
    }, []);

    useImperativeHandle(ref, () => ({ switchCwd }), [switchCwd]);

    if (mode === 'gui') {
      return <AgentGUIPanel />;
    }

    return <AgentTerminal ref={agentTerminalRef} />;
  }
);

export default AgentTerminalMode;
