import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30s — Tauri IPC 本地调用很快
      gcTime: 5 * 60_000,          // 5 分钟
      refetchOnWindowFocus: false, // 桌面应用不需要
      retry: 1,
    },
  },
});

export default queryClient;
