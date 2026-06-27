import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { filesApi } from '../api';
import type { FileTreeNode } from '../api';

export interface DirState {
  path: string;
  tree: FileTreeNode[];
  expanded: Set<string>;
  loading: boolean;
}

export interface FileTreeExpandState {
  dirs: DirState[];
  loadingDirPaths: Set<string>;
  expanded: Set<string>;
}

export interface FileTreeExpandActions {
  toggleDir: (path: string) => void;
  collapseAll: () => void;
  loadChildren: (path: string) => void;
  refreshDir: (path: string, fetchRootTree: (path: string) => void) => void;
  initRootTrees: (roots: { path: string }[], initialExpanded: Set<string>, fetchRootTree: (path: string) => void) => void;
  updateDirs: (updater: (prev: DirState[]) => DirState[]) => void;
}

export type FileTreeExpand = FileTreeExpandState & FileTreeExpandActions;

/** Normalize path separators to '/' and strip trailing separator */
export function normPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

/** Tracks paths currently being fetched by loadChildren — allows callers to skip redundant refreshes */
const loadChildrenInFlight = new Set<string>();
export function isLoadChildrenBusy(path?: string): boolean {
  return path ? loadChildrenInFlight.has(normPath(path)) : loadChildrenInFlight.size > 0;
}

/** Merge new tree with existing tree, preserving loaded children of expanded nodes */
export function mergeTrees(
  newTree: FileTreeNode[],
  existingTree: FileTreeNode[],
  expanded: Set<string>,
): FileTreeNode[] {
  const existingMap = new Map<string, FileTreeNode>();
  for (const node of existingTree) existingMap.set(normPath(node.path), node);

  return newTree.map(node => {
    if (!node.isDir) return node;
    const existing = existingMap.get(normPath(node.path));
    // Only recurse when the API actually returned deeper data for this dir.
    // A shallow refresh (getTree(root, 1)) yields empty children arrays for
    // sub-directories — recursing into those would erase previously
    // lazy-loaded subtrees and render expanded folders as "空目录".
    const newChildren = node.children ?? [];
    if (expanded.has(normPath(node.path))
      && newChildren.length > 0
      && existing?.children && existing.children.length > 0) {
      return { ...node, children: mergeTrees(newChildren, existing.children, expanded) };
    }
    // Shallow refresh: keep the already-loaded children instead of overwriting
    // them with the API's empty array. Refresh metadata (hasChildren etc.) only.
    if (existing?.children && existing.children.length > 0) {
      return { ...node, children: existing.children };
    }
    return node;
  });
}

/** Find a node by path and replace its children */
function findAndUpdateNode(
  nodes: FileTreeNode[],
  targetPath: string,
  children: FileTreeNode[],
): FileTreeNode[] {
  const target = normPath(targetPath);
  return nodes.map(node => {
    if (normPath(node.path) === target) return { ...node, children };
    if (node.isDir && node.children) {
      return { ...node, children: findAndUpdateNode(node.children, targetPath, children) };
    }
    return node;
  });
}

/** Find the DirState that contains the given path */
export function findDir(dirs: DirState[], path: string): DirState | undefined {
  const np = normPath(path);
  return dirs.find(d => {
    const nd = normPath(d.path);
    return np === nd || np.startsWith(nd + '/');
  });
}

/** Depth-first search for a node by normalized path within a tree */
export function findNodeInTree(nodes: FileTreeNode[], path: string): FileTreeNode | undefined {
  const target = normPath(path);
  for (const n of nodes) {
    if (normPath(n.path) === target) return n;
    if (n.isDir && n.children) {
      const found = findNodeInTree(n.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

export function useFileTreeExpand(
  _initialRoots: { path: string }[],
  persistExpanded: (expanded: string[]) => void,
): FileTreeExpand {
  const [dirs, setDirs] = useState<DirState[]>([]);
  const [loadingDirPaths, setLoadingDirPaths] = useState<Set<string>>(new Set());
  const dirsRef = useRef(dirs);
  dirsRef.current = dirs;
  const fetchingRef = useRef(new Set<string>());
  const fetchGenerationRef = useRef(new Map<string, number>());
  const pendingAutoExpandRef = useRef<Set<string> | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Union of all roots' expanded sets
  const expanded = useMemo(
    () => new Set(dirs.flatMap(d => [...d.expanded])),
    [dirs],
  );

  // Persist expanded state (debounced)
  useEffect(() => {
    const expandedPaths = [...new Set(dirs.flatMap(d => [...d.expanded]))];
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => persistExpanded(expandedPaths), 300);
  }, [dirs, persistExpanded]);

  // Check subtree for nodes that need lazy loading, mark as pending
  const autoExpandSubtree = useCallback((tree: FileTreeNode[], expandedSet: Set<string>) => {
    for (const node of tree) {
      if (!node.isDir || !expandedSet.has(normPath(node.path))) continue;
      // Skip if already has children loaded or is currently being fetched
      // node.hasChildren: backend hint; fallback to true if missing (backward compat)
      const mightHaveChildren = node.hasChildren !== false;
      if (mightHaveChildren && node.children && node.children.length > 0) continue;
      if (fetchingRef.current.has(normPath(node.path))) continue;
      if (!pendingAutoExpandRef.current) pendingAutoExpandRef.current = new Set();
      pendingAutoExpandRef.current.add(normPath(node.path));
    }
  }, []);

  // Lazy-load children for a directory node
  const loadChildren = useCallback((path: string) => {
    const np = normPath(path);
    if (fetchingRef.current.has(np)) return;
    fetchingRef.current.add(np);
    loadChildrenInFlight.add(np);

    const gen = (fetchGenerationRef.current.get(np) ?? 0) + 1;
    fetchGenerationRef.current.set(np, gen);

    // Mark as loading
    setLoadingDirPaths(prev => {
      const next = new Set(prev);
      next.add(np);
      return next;
    });

    filesApi.getTree(np, 1).then(children => {
      if (fetchGenerationRef.current.get(np) !== gen) return;
      fetchingRef.current.delete(np);
      loadChildrenInFlight.delete(np);

      // Clear loading
      setLoadingDirPaths(prev => {
        const next = new Set(prev);
        next.delete(np);
        return next;
      });

      // Use functional updater to always read the latest state — avoids stale dirsRef.current
      let childrenToExpand: FileTreeNode[] | null = null;
      let expandedForCheck: Set<string> | null = null;
      setDirs(prev => {
        const updated = prev.map(d =>
          findDir([d], np)
            ? { ...d, tree: findAndUpdateNode(d.tree, np, children) }
            : d
        );
        // Capture data for auto-expand check (side-effect-free: only reads state)
        const dir = findDir(updated, np);
        if (dir) {
          childrenToExpand = children;
          expandedForCheck = dir.expanded;
        }
        return updated;
      });

      // Check if any newly loaded children have expanded sub-nodes that need lazy loading.
      // Deferred to after setDirs to avoid mutating pendingAutoExpandRef inside a state updater.
      if (childrenToExpand && expandedForCheck) {
        autoExpandSubtree(childrenToExpand, expandedForCheck);
      }
    }).catch((err) => {
      if (fetchGenerationRef.current.get(np) !== gen) return;
      fetchingRef.current.delete(np);
      loadChildrenInFlight.delete(np);

      // Clear loading
      setLoadingDirPaths(prev => {
        const next = new Set(prev);
        next.delete(np);
        return next;
      });

      console.error('Failed to load directory children:', np, err);

      // Revert expand state on failure
      setDirs(prev => prev.map(d => {
        if (!findDir([d], np)) return d;
        const reverted = new Set(d.expanded);
        reverted.delete(np);
        return { ...d, expanded: reverted };
      }));
    });
  }, [autoExpandSubtree, setDirs]);

  // Process pending auto-expand paths
  useEffect(() => {
    if (!pendingAutoExpandRef.current || pendingAutoExpandRef.current.size === 0) return;
    const paths = [...pendingAutoExpandRef.current];
    pendingAutoExpandRef.current = null;

    for (const path of paths) {
      loadChildren(path);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirs, loadChildren]);

  // Toggle a directory's expand/collapse state
  const toggleDir = useCallback((path: string) => {
    const np = normPath(path);

    // Decide lazily-load OUTSIDE the setDirs updater. Reading dirsRef here is
    // safe (event-handler context) and avoids relying on a side-effect variable
    // mutated inside the updater — React (StrictMode) may invoke the updater
    // twice and discard the first run, which previously swallowed fetchPath.
    const dir = findDir(dirsRef.current, np);
    const alreadyExpanded = dir?.expanded.has(np) ?? false;
    let needsFetch = false;
    if (dir && !alreadyExpanded) {
      const node = findNodeInTree(dir.tree, np);
      // Only fetch if directory has children but they haven't been loaded yet
      // node.hasChildren: backend hint; fallback to true if missing (backward compat)
      needsFetch = !!node && node.isDir && node.hasChildren !== false
        && (!node.children || node.children.length === 0);
    }

    // Pure state transition: updater has no side effects.
    setDirs(prev => {
      const d = findDir(prev, np);
      if (!d) return prev;
      const next = new Set(d.expanded);
      if (next.has(np)) next.delete(np);
      else next.add(np);
      return prev.map(dd =>
        findDir([dd], np) ? { ...dd, expanded: next } : dd
      );
    });

    if (needsFetch) {
      // Mark as loading synchronously so the render before loadChildren's async setLoadingDirPaths shows "加载中..."
      setLoadingDirPaths(prev => {
        const next = new Set(prev);
        next.add(np);
        return next;
      });
      loadChildren(np);
    }
  }, [loadChildren]);

  // Collapse all directories
  const collapseAll = useCallback(() => {
    setDirs(prev => prev.map(d => ({ ...d, expanded: new Set<string>() })));
  }, []);

  // Refresh a directory tree from its root
  const refreshDir = useCallback((path: string, fetchRootTree: (path: string) => void) => {
    const np = normPath(path);
    fetchingRef.current.delete(np);
    setDirs(prev => {
      const rootDir = findDir(prev, np);
      if (rootDir) {
        fetchRootTree(rootDir.path);
        return prev.map(d =>
          normPath(d.path) === normPath(rootDir.path) ? { ...d, tree: [], loading: true } : d
        );
      }
      return prev;
    });
  }, []);

  // Initialize root trees from loaded data
  const initRootTrees = useCallback((
    roots: { path: string }[],
    initialExpanded: Set<string>,
    fetchRootTree: (path: string) => void,
  ) => {
    const rootFetches: string[] = [];

    // Normalize the initial expanded set once
    const normalizedExpanded = new Set([...initialExpanded].map(normPath));

    setDirs(prev => {
      // Skip roots that already exist (prevents duplicates from Strict Mode double-mount)
      const existingPaths = new Set(prev.map(d => normPath(d.path)));
      const fresh = roots.filter(root => !existingPaths.has(normPath(root.path)));
      if (fresh.length === 0) return prev;

      const initial = fresh.map(root => {
        const nRoot = normPath(root.path);
        // Partition expanded paths that belong to this root
        const rootExpanded = new Set<string>();
        for (const ep of normalizedExpanded) {
          if (ep === nRoot || ep.startsWith(nRoot + '/')) {
            rootExpanded.add(ep);
          }
        }
        return {
          path: root.path,
          tree: [] as FileTreeNode[],
          expanded: rootExpanded,
          loading: true,
        };
      });

      // Collect roots to fetch (fetchRootTree triggers auto-expand after tree loads)
      for (const root of initial) {
        rootFetches.push(normPath(root.path));
        fetchRootTree(root.path);
      }

      return [...prev, ...initial];
    });

    // Update loading state
    setLoadingDirPaths(prev => {
      const next = new Set(prev);
      for (const path of rootFetches) next.add(path);
      return next;
    });
  }, []);

  // 清理模块级 in-flight 路径集合，防止卸载后残留脏数据
  useEffect(() => {
    return () => { loadChildrenInFlight.clear(); };
  }, []);

  return { dirs, loadingDirPaths, expanded, toggleDir, collapseAll, loadChildren, refreshDir, initRootTrees, updateDirs: setDirs };
}
