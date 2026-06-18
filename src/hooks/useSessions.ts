import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import { sessionsApi } from '../api';

export function useSessions(limit?: number) {
  return useQuery({
    queryKey: queryKeys.sessions.all,
    queryFn: () => sessionsApi.list(limit),
    refetchInterval: 5000,
  });
}

export function useSessionMessages(sessionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sessions.messages(sessionId!),
    queryFn: () => sessionsApi.messages(sessionId!),
    refetchInterval: 5000,
    enabled: !!sessionId && enabled,
  });
}

export function useEndSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => sessionsApi.end(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}
