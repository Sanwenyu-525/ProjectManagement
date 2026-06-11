import TerminalManager from './TerminalManager';

interface GlobalTerminalPanelProps {
  visible: boolean;
  defaultCwd?: string | null;
  defaultCommand?: string | null;
}

export default function GlobalTerminalPanel({ visible, defaultCwd, defaultCommand }: GlobalTerminalPanelProps) {
  return <TerminalManager visible={visible} defaultCwd={defaultCwd} defaultCommand={defaultCommand} />;
}
