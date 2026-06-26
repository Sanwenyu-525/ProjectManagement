import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import { auditApi } from '../api';
import type { ProjectAuditResult, AuditRecord } from '../types';

export function useAuditHistory(projectId: string | undefined, limit?: number) {
  return useQuery<AuditRecord[]>({
    queryKey: queryKeys.audit.history(projectId!),
    queryFn: () => auditApi.getProjectHistory(projectId!, limit),
    enabled: !!projectId,
  });
}

export function useRunAudit(projectId: string) {
  const qc = useQueryClient();
  return useMutation<ProjectAuditResult, Error, void>({
    mutationFn: () => auditApi.runForProject(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.audit.history(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.audit.latestAll });
    },
  });
}

export function useLatestAudits() {
  return useQuery<AuditRecord[]>({
    queryKey: queryKeys.audit.latestAll,
    queryFn: () => auditApi.getLatestAll(),
  });
}
