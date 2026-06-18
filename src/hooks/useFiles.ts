import { useQuery, useMutation } from '@tanstack/react-query';
import { filesApi } from '../api';
import { queryKeys } from '../api/queryKeys';

// ==================== File Queries ====================

export function useFileTree(root: string | undefined, depth?: number) {
  return useQuery({
    queryKey: queryKeys.files.tree(root ?? '', depth),
    queryFn: () => filesApi.getTree(root!, depth),
    enabled: !!root,
  });
}

export function useFileContent(path: string | undefined) {
  return useQuery({
    queryKey: queryKeys.files.content(path ?? ''),
    queryFn: () => filesApi.read(path!),
    enabled: !!path,
  });
}

export function useFileDirectory(path: string | undefined) {
  return useQuery({
    queryKey: queryKeys.files.directory(path ?? ''),
    queryFn: () => filesApi.listDirectory(path!),
    enabled: !!path,
  });
}

// ==================== File Mutations ====================

export function useWriteFile() {
  return useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      filesApi.write(path, content),
  });
}

export function useCreateFile() {
  return useMutation({
    mutationFn: ({ path, isDir }: { path: string; isDir?: boolean }) =>
      filesApi.create(path, isDir),
  });
}

export function useRenameFile() {
  return useMutation({
    mutationFn: ({ oldPath, newPath }: { oldPath: string; newPath: string }) =>
      filesApi.rename(oldPath, newPath),
  });
}

export function useDeleteFile() {
  return useMutation({
    mutationFn: (path: string) => filesApi.delete(path),
  });
}

export function useOpenInIde() {
  return useMutation({
    mutationFn: ({ path, ide }: { path: string; ide?: string }) =>
      filesApi.openInIde(path, ide),
  });
}
