import { useEffect } from 'react';
import { networkApi } from '../../../api';
import { usePreviewStore } from '../../../stores/previewStore';

/**
 * 定期扫描本地端口，发现运行中的开发服务器。
 * 从 WorkspacePage 提取，减少主组件的 store 依赖。
 */
export function usePortScan() {
  useEffect(() => {
    const scan = async () => {
      try {
        const activePorts = await networkApi.scanActivePorts();
        for (const port of activePorts) {
          usePreviewStore.getState().addPreview(`http://localhost:${port}`, 'port-scan');
        }
      } catch { /* ignore scan errors */ }
    };
    scan();
    const id = setInterval(scan, 15_000);
    return () => clearInterval(id);
  }, []);
}
