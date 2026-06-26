/**
 * Dependency graph utilities for parallel plan execution.
 *
 * All functions are pure — no side effects, no store access.
 */

interface StepLike {
  taskId: string;
  dependsOn: string[];
  status: string;
}

/**
 * Detect cycles in the dependency graph using DFS (white/gray/black coloring).
 * Returns null if valid, or an error message describing the cycle.
 */
export function validateDependencyGraph(steps: StepLike[]): string | null {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const s of steps) {
    color.set(s.taskId, WHITE);
    adj.set(s.taskId, s.dependsOn.filter(d => steps.some(x => x.taskId === d)));
  }

  function dfs(node: string, path: string[]): string | null {
    color.set(node, GRAY);
    path.push(node);

    for (const dep of (adj.get(node) || [])) {
      const c = color.get(dep);
      if (c === GRAY) {
        // Found a cycle — extract the cycle path
        const cycleStart = path.indexOf(dep);
        const cycle = path.slice(cycleStart).concat(dep);
        return `循环依赖: ${cycle.join(' → ')}`;
      }
      if (c === WHITE) {
        const result = dfs(dep, path);
        if (result) return result;
      }
    }

    path.pop();
    color.set(node, BLACK);
    return null;
  }

  for (const s of steps) {
    if (color.get(s.taskId) === WHITE) {
      const result = dfs(s.taskId, []);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Build execution layers using Kahn's algorithm (topological sort).
 * Each layer contains taskIds that can execute in parallel.
 * Steps within a layer have no dependencies on each other.
 */
export function buildDependencyLayers(steps: StepLike[]): string[][] {
  const idSet = new Set(steps.map(s => s.taskId));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>(); // dependency -> dependents

  for (const s of steps) {
    const validDeps = s.dependsOn.filter(d => idSet.has(d));
    inDegree.set(s.taskId, validDeps.length);
    for (const dep of validDeps) {
      if (!adj.has(dep)) adj.set(dep, []);
      adj.get(dep)!.push(s.taskId);
    }
  }

  const layers: string[][] = [];
  // Start with all nodes that have in-degree 0
  const queue = steps.filter(s => (inDegree.get(s.taskId) || 0) === 0).map(s => s.taskId);

  while (queue.length > 0) {
    layers.push([...queue]);
    const nextQueue: string[] = [];
    for (const nodeId of queue) {
      for (const dependent of (adj.get(nodeId) || [])) {
        const deg = (inDegree.get(dependent) || 1) - 1;
        inDegree.set(dependent, deg);
        if (deg === 0) nextQueue.push(dependent);
      }
    }
    queue.length = 0;
    queue.push(...nextQueue);
  }

  return layers;
}

/**
 * Get step IDs that are ready to execute: status is 'pending' and all
 * dependencies are in 'done' status.
 */
export function getReadySteps(steps: StepLike[]): string[] {
  const statusMap = new Map(steps.map(s => [s.taskId, s.status]));
  return steps
    .filter(s =>
      s.status === 'pending' &&
      s.dependsOn.every(dep => statusMap.get(dep) === 'done')
    )
    .map(s => s.taskId);
}
