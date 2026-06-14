import type { PaneNode, PaneLeaf } from './types';

export function getAllLeaves(node: PaneNode): PaneLeaf[] {
  if (node.type === 'leaf') return [node];
  return node.children.flatMap(getAllLeaves);
}

export function findLeaf(node: PaneNode, id: string): PaneLeaf | null {
  if (node.type === 'leaf') return node.id === id ? node : null;
  for (const child of node.children) {
    const found = findLeaf(child, id);
    if (found) return found;
  }
  return null;
}

export function findLeafWithTab(root: PaneNode, tabId: string): PaneLeaf | null {
  if (root.type === 'leaf' && root.tabIds.includes(tabId)) return root;
  if (root.type === 'split') {
    for (const child of root.children) {
      const found = findLeafWithTab(child, tabId);
      if (found) return found;
    }
  }
  return null;
}
