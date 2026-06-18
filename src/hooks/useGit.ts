import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import { gitApi } from '../api';

// ==================== Git Queries ====================

export function useGitStatus(repoPath: string | null) {
  return useQuery({
    queryKey: queryKeys.git.status(repoPath!),
    queryFn: () => gitApi.status(repoPath!),
    enabled: !!repoPath,
  });
}

export function useGitLog(repoPath: string | null, limit?: number) {
  return useQuery({
    queryKey: [...queryKeys.git.log(repoPath!), limit],
    queryFn: () => gitApi.log(repoPath!, limit),
    enabled: !!repoPath,
  });
}

export function useGitBranches(repoPath: string | null) {
  return useQuery({
    queryKey: queryKeys.git.branches(repoPath!),
    queryFn: () => gitApi.branches(repoPath!),
    enabled: !!repoPath,
  });
}

export function useGitStashList(repoPath: string | null) {
  return useQuery({
    queryKey: queryKeys.git.stashList(repoPath!),
    queryFn: () => gitApi.stashList(repoPath!),
    enabled: !!repoPath,
  });
}

export function useGitTagList(repoPath: string | null) {
  return useQuery({
    queryKey: queryKeys.git.tagList(repoPath!),
    queryFn: () => gitApi.tagList(repoPath!),
    enabled: !!repoPath,
  });
}

// ==================== Git Mutations ====================

function invalidateGitQueries(qc: ReturnType<typeof useQueryClient>, repoPath: string) {
  qc.invalidateQueries({ queryKey: queryKeys.git.status(repoPath) });
  qc.invalidateQueries({ queryKey: queryKeys.git.log(repoPath) });
  qc.invalidateQueries({ queryKey: queryKeys.git.branches(repoPath) });
  qc.invalidateQueries({ queryKey: queryKeys.git.stashList(repoPath) });
}

export function useGitCommit(repoPath: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => gitApi.commit(repoPath!, message),
    onSuccess: () => { if (repoPath) invalidateGitQueries(qc, repoPath); },
  });
}

export function useGitPush(repoPath: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ remote, branch }: { remote?: string; branch?: string }) =>
      gitApi.push(repoPath!, remote, branch),
    onSuccess: () => { if (repoPath) invalidateGitQueries(qc, repoPath); },
  });
}

export function useGitPull(repoPath: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ remote, branch }: { remote?: string; branch?: string }) =>
      gitApi.pull(repoPath!, remote, branch),
    onSuccess: () => { if (repoPath) invalidateGitQueries(qc, repoPath); },
  });
}

export function useGitFetch(repoPath: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => gitApi.fetch(repoPath!),
    onSuccess: () => { if (repoPath) invalidateGitQueries(qc, repoPath); },
  });
}

export function useGitAdd(repoPath: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: string[]) => gitApi.add(repoPath!, files),
    onSuccess: () => { if (repoPath) invalidateGitQueries(qc, repoPath); },
  });
}

export function useGitUnstage(repoPath: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: string[]) => gitApi.unstage(repoPath!, files),
    onSuccess: () => { if (repoPath) invalidateGitQueries(qc, repoPath); },
  });
}

export function useGitBranchSwitch(repoPath: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branch: string) => gitApi.branchSwitch(repoPath!, branch),
    onSuccess: () => { if (repoPath) invalidateGitQueries(qc, repoPath); },
  });
}

export function useGitBranchCreate(repoPath: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branchName: string) => gitApi.branchCreate(repoPath!, branchName),
    onSuccess: () => { if (repoPath) invalidateGitQueries(qc, repoPath); },
  });
}

export function useGitRestore(repoPath: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: string[]) => gitApi.restore(repoPath!, files),
    onSuccess: () => { if (repoPath) invalidateGitQueries(qc, repoPath); },
  });
}

export function useGitRevert(repoPath: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hash: string) => gitApi.revert(repoPath!, hash),
    onSuccess: () => { if (repoPath) invalidateGitQueries(qc, repoPath); },
  });
}

export function useGitTagCreate(repoPath: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, message }: { name: string; message?: string }) =>
      gitApi.tagCreate(repoPath!, name, message),
    onSuccess: () => { if (repoPath) { qc.invalidateQueries({ queryKey: queryKeys.git.tagList(repoPath) }); } },
  });
}

export function useGitTagDelete(repoPath: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => gitApi.tagDelete(repoPath!, name),
    onSuccess: () => { if (repoPath) { qc.invalidateQueries({ queryKey: queryKeys.git.tagList(repoPath) }); } },
  });
}
