import { useCallback } from 'react';
import { useTerminalStore } from '../../stores/terminalStore';
import TerminalInstance from '../TerminalInstance';
import TerminalTabBar from './TerminalTabBar';
import { terminalApi } from '../../api';

interface TerminalPaneProps {
  pane: 'left' | 'right';
  onCreateTerminal: (groupId?: string) => void;
  onTerminalInput: (terminalId: string, data: string) => void;
}

export default function TerminalPane({ pane, onCreateTerminal, onTerminalInput }: TerminalPaneProps) {
  const terminals = useTerminalStore(s => s.terminals);
  const paneState = useTerminalStore(s => pane === 'left' ? s.leftPane : s.rightPane);
  const setActiveId = useTerminalStore(s => s.setActiveId);
  const updateTerminal = useTerminalStore(s => s.updateTerminal);
  const removeTerminal = useTerminalStore(s => s.removeTerminal);
  const theme = useTerminalStore(s => s.theme);

  const activeId = paneState.activeId;

  // Filter terminals for this pane
  const paneTerminals = terminals.filter(t => t.pane === pane);

  const handleSelect = useCallback((id: string) => {
    setActiveId(pane, id);
  }, [pane, setActiveId]);

  const handleClose = useCallback(async (id: string) => {
    try {
      await terminalApi.stop(id);
    } catch {
      // Terminal may have already exited
    }

    const remaining = paneTerminals.filter(t => t.id !== id);
    removeTerminal(id);

    if (activeId === id) {
      setActiveId(pane, remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  }, [activeId, pane, paneTerminals, removeTerminal, setActiveId]);

  const handleRename = useCallback((id: string, label: string) => {
    updateTerminal(id, { label });
  }, [updateTerminal]);

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <TerminalTabBar
        pane={pane}
        activeId={activeId}
        onSelect={handleSelect}
        onClose={handleClose}
        onRename={handleRename}
        onCreateTerminal={onCreateTerminal}
        terminalCount={terminals.length}
        maxTerminals={10}
      />

      {/* Terminal viewport */}
      <div style={{
        flex: 1,
        padding: '8px 4px',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {paneTerminals.map(t => (
          <TerminalInstance
            key={t.id}
            terminal={t}
            theme={theme}
            isActive={activeId === t.id}
            onInput={onTerminalInput}
          />
        ))}

        {paneTerminals.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: '#555',
          }}>
            <div style={{ marginBottom: 12, fontSize: 13 }}>无活动终端</div>
            <button
              onClick={() => onCreateTerminal()}
              style={{
                background: '#007acc',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              新建终端
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
