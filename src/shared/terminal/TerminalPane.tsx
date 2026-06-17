import { useCallback } from 'react';
import { useTerminalStore } from '../../stores/terminalStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import TerminalInstance from '../TerminalInstance';
import TerminalTabBar from './TerminalTabBar';
import { terminalApi } from '../../api';
import { PanePosition } from '../terminalTypes';

interface TerminalPaneProps {
  pane: PanePosition;
  onCreateTerminal: (groupId?: string) => void;
  onTerminalInput: (terminalId: string, data: string) => void;
}

export default function TerminalPane({ pane, onCreateTerminal, onTerminalInput }: TerminalPaneProps) {
  const terminals = useTerminalStore(s => s.terminals);
  const paneState = useWorkspaceStore(s => {
    if (pane === 'left') return s.leftPane;
    if (pane === 'right') return s.rightPane;
    if (pane === 'top') return s.topPane;
    return s.bottomPane;
  });
  const setActiveId = useWorkspaceStore(s => s.setActiveId);
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
            color: 'var(--ws-text-secondary, #6b7a99)',
          }}>
            <div style={{ marginBottom: 12, fontSize: 13 }}>无活动终端</div>
            <button
              onClick={() => onCreateTerminal()}
              style={{
                background: 'var(--ws-active-bg, rgba(99,102,241,0.10))',
                color: 'var(--ws-active-border, #6366f1)',
                border: '1px solid var(--ws-border, rgba(0,0,0,0.08))',
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
