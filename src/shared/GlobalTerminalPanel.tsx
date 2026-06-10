import TerminalManager from './TerminalManager';

interface GlobalTerminalPanelProps {
  visible: boolean;
}

export default function GlobalTerminalPanel({ visible }: GlobalTerminalPanelProps) {
  return <TerminalManager visible={visible} />;
}
