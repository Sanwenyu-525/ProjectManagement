import { cmd } from './client';

export const networkApi = {
  scanActivePorts: () => cmd<number[]>('network_scan_active_ports'),
};
