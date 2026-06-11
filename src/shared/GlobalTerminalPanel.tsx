import TerminalManager from './TerminalManager';
import { LaunchRequest } from '../stores/terminalStore';

interface GlobalTerminalPanelProps {
  visible: boolean;
  launchRequest: LaunchRequest | null;
  consumeLaunchRequest: () => LaunchRequest | null;
}

export default function GlobalTerminalPanel({ visible, launchRequest, consumeLaunchRequest }: GlobalTerminalPanelProps) {
  return <TerminalManager visible={visible} launchRequest={launchRequest} consumeLaunchRequest={consumeLaunchRequest} />;
}
