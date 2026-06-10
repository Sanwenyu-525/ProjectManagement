import TerminalManager from './TerminalManager';

interface GlobalTerminalPanelProps {
  visible: boolean;
  defaultCwd?: string | null;
}

export default function GlobalTerminalPanel({ visible, defaultCwd }: GlobalTerminalPanelProps) {
  return <TerminalManager visible={visible} defaultCwd={defaultCwd} />;
}
