import { getThemeColors } from '../../../lib/themeColors';
import type { GraphData, ImpactResult, ChainResult, LayerResult } from '../../../types';

export type LayoutType = 'force' | 'tree' | 'concentric' | 'matrix';
export type ViewMode = 'business' | 'architecture' | 'callchain' | 'impact' | 'dependency';

export const LAYOUT_OPTIONS = [
  { label: '力导向', value: 'force' },
  { label: '层次', value: 'tree' },
  { label: '同心圆', value: 'concentric' },
  { label: '矩阵', value: 'matrix' },
];

export const VIEW_OPTIONS = [
  { label: '业务', value: 'business' },
  { label: '架构', value: 'architecture' },
  { label: '调用链', value: 'callchain' },
  { label: '影响分析', value: 'impact' },
  { label: '文件依赖', value: 'dependency' },
];

export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Rust: '#dea584',
  Python: '#3572A5',
  Go: '#00ADD8',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  CSS: '#563d7c',
  HTML: '#e34c26',
};

export const GROUP_PALETTE = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e84393', '#00cec9', '#6c5ce7',
];

export interface GroupColorInfo {
  color: string;
  groupId: string;
}

// ── Layout position computation ──

function computeTreePositions(data: GraphData): Map<string, { x: number; y: number }> {
  const { nodes, edges } = data;
  const pos = new Map<string, { x: number; y: number }>();
  const inDeg = new Map<string, number>();
  const children = new Map<string, string[]>();
  nodes.forEach(n => { inDeg.set(n.id, 0); children.set(n.id, []); });
  edges.forEach(e => {
    inDeg.set(e.targetNodeId, (inDeg.get(e.targetNodeId) || 0) + 1);
    children.get(e.sourceNodeId)?.push(e.targetNodeId);
  });

  const roots = nodes.filter(n => (inDeg.get(n.id) || 0) === 0).map(n => n.id);
  const visited = new Set<string>();
  const levels: string[][] = [];

  let queue = roots.length > 0 ? roots : [nodes[0]?.id].filter(Boolean);
  while (queue.length > 0) {
    const next: string[] = [];
    levels.push(queue);
    queue.forEach(id => visited.add(id));
    for (const id of queue) {
      for (const child of (children.get(id) || [])) {
        if (!visited.has(child)) {
          visited.add(child);
          next.push(child);
        }
      }
    }
    queue = next;
  }
  const unvisited = nodes.filter(n => !visited.has(n.id));
  if (unvisited.length > 0) {
    levels.push(unvisited.map(n => n.id));
  }

  const levelGap = Math.max(80, 600 / Math.max(levels.length, 1));
  levels.forEach((ids, levelIdx) => {
    const y = 40 + levelIdx * levelGap;
    const nodeGap = Math.max(50, 1000 / Math.max(ids.length, 1));
    const startX = -(ids.length - 1) * nodeGap / 2;
    ids.forEach((id, i) => pos.set(id, { x: startX + i * nodeGap, y }));
  });
  return pos;
}

function computeConcentricPositions(data: GraphData): Map<string, { x: number; y: number }> {
  const { nodes, edges } = data;
  const pos = new Map<string, { x: number; y: number }>();
  const inDeg = new Map<string, number>();
  nodes.forEach(n => { inDeg.set(n.id, 0); });
  edges.forEach(e => { inDeg.set(e.targetNodeId, (inDeg.get(e.targetNodeId) || 0) + 1); });

  const maxDeg = Math.max(...nodes.map(n => inDeg.get(n.id) || 0), 1);
  const ringCount = Math.min(6, Math.max(2, Math.ceil(Math.log2(maxDeg + 1))));
  const rings: string[][] = Array.from({ length: ringCount }, () => []);
  nodes.forEach(n => {
    const deg = inDeg.get(n.id) || 0;
    const ring = ringCount - 1 - Math.min(ringCount - 1, Math.floor((deg / (maxDeg + 1)) * ringCount));
    rings[ring].push(n.id);
  });

  const maxRadius = 400;
  rings.forEach((ids, ringIdx) => {
    if (ids.length === 0) return;
    const r = ids.length === 1 ? 0 : (maxRadius / ringCount) * (ringIdx + 1);
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / ids.length;
      pos.set(id, { x: r * Math.cos(angle), y: r * Math.sin(angle) });
    });
  });
  return pos;
}

function buildMatrixOption(
  data: GraphData,
  tc: ReturnType<typeof getThemeColors>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const { nodes, edges } = data;

  const inDeg = new Map<string, number>();
  nodes.forEach(n => inDeg.set(n.id, 0));
  edges.forEach(e => inDeg.set(e.targetNodeId, (inDeg.get(e.targetNodeId) || 0) + 1));

  const byDir = new Map<string, typeof nodes>();
  nodes.forEach(n => {
    const dir = n.directory || '/';
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(n);
  });
  const sortedDirs = [...byDir.keys()].sort();
  const sortedNodes = sortedDirs.flatMap(d => (byDir.get(d) || []).sort((a, b) => a.fileName.localeCompare(b.fileName)));
  const MAX_MATRIX = 80;
  const displayNodes = sortedNodes.slice(0, MAX_MATRIX);
  const nodeIdSet = new Set(displayNodes.map(n => n.id));
  const nodeIdToIdx = new Map(displayNodes.map((n, i) => [n.id, i]));

  const matrixData: [number, number, number][] = [];
  const edgeSet = new Set<string>();
  for (const e of edges) {
    if (nodeIdSet.has(e.sourceNodeId) && nodeIdSet.has(e.targetNodeId)) {
      const si = nodeIdToIdx.get(e.sourceNodeId)!;
      const ti = nodeIdToIdx.get(e.targetNodeId)!;
      const key = `${si},${ti}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        matrixData.push([si, ti, 1]);
      }
    }
  }

  const labels = displayNodes.map(n => {
    const dir = n.directory.split('/').pop() || '';
    return dir ? `${dir}/${n.fileName}` : n.fileName;
  });

  return {
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: tc.bgElevated,
      borderColor: tc.border,
      textStyle: { color: tc.text, fontSize: 12 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        if (params.componentType === 'series' && params.data) {
          const [x, y] = params.data;
          const src = displayNodes[x];
          const tgt = displayNodes[y];
          if (src && tgt) return `<strong>${src.filePath}</strong> → <strong>${tgt.filePath}</strong>`;
        }
        return '';
      },
    },
    grid: { top: 10, right: 10, bottom: 80, left: 80 },
    xAxis: {
      type: 'category' as const,
      data: labels,
      splitArea: { show: true },
      axisLabel: {
        rotate: 90,
        fontSize: 9,
        color: tc.textSecondary,
        interval: 0,
        overflow: 'truncate',
        width: 60,
      },
    },
    yAxis: {
      type: 'category' as const,
      data: labels,
      splitArea: { show: true },
      axisLabel: {
        fontSize: 9,
        color: tc.textSecondary,
        overflow: 'truncate',
        width: 60,
      },
    },
    visualMap: {
      show: false,
      min: 0,
      max: 1,
      inRange: {
        color: [tc.bgElevated || '#fff', tc.primary],
      },
    },
    series: [{
      type: 'heatmap' as const,
      data: matrixData,
      emphasis: {
        itemStyle: { borderColor: tc.primary, borderWidth: 2 },
      },
    }],
  };
}

export function buildGraphOption(
  data: GraphData,
  tc: ReturnType<typeof getThemeColors>,
  nodeColorMap?: Map<string, GroupColorInfo>,
  selectedGroupId?: string | null,
  layoutType: LayoutType = 'force',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (layoutType === 'matrix') {
    return buildMatrixOption(data, tc);
  }

  const { nodes, edges } = data;

  const inDegree: Record<string, number> = {};
  nodes.forEach(n => { inDegree[n.id] = 0; });
  edges.forEach(e => { inDegree[e.targetNodeId] = (inDegree[e.targetNodeId] || 0) + 1; });

  const positions = layoutType === 'tree'
    ? computeTreePositions(data)
    : layoutType === 'concentric'
      ? computeConcentricPositions(data)
      : null;

  const chartNodes = nodes.map(n => {
    const groupInfo = nodeColorMap?.get(n.id);
    const isSelectedGroup = selectedGroupId && groupInfo?.groupId === selectedGroupId;
    const isDimmed = selectedGroupId && !isSelectedGroup;
    const baseColor = groupInfo ? groupInfo.color : (LANGUAGE_COLORS[n.language] || tc.primary);
    const pos = positions?.get(n.id);

    return {
      id: n.id,
      name: n.filePath,
      x: pos?.x,
      y: pos?.y,
      fixed: !!positions,
      symbolSize: Math.max(8, Math.min(40, 8 + (inDegree[n.id] || 0) * 3)),
      itemStyle: {
        color: baseColor,
        opacity: isDimmed ? 0.15 : 1,
        borderColor: isSelectedGroup ? groupInfo!.color : undefined,
        borderWidth: isSelectedGroup ? 3 : 0,
      },
      label: {
        show: (inDegree[n.id] || 0) > 2 && !isDimmed,
      },
      filePath: n.filePath,
      fileName: n.fileName,
      language: n.language,
      directory: n.directory,
      lineCount: n.lineCount,
      inDegree: inDegree[n.id] || 0,
    };
  });

  const chartEdges = edges.map(e => {
    const srcGroup = nodeColorMap?.get(e.sourceNodeId);
    const tgtGroup = nodeColorMap?.get(e.targetNodeId);
    const sameGroup = srcGroup && tgtGroup && srcGroup.groupId === tgtGroup.groupId;
    const isDimmed = selectedGroupId &&
      srcGroup?.groupId !== selectedGroupId &&
      tgtGroup?.groupId !== selectedGroupId;

    return {
      source: e.sourceNodeId,
      target: e.targetNodeId,
      importPath: e.importPath,
      lineStyle: {
        width: sameGroup ? 2 : 1,
        opacity: isDimmed ? 0.08 : sameGroup ? 0.9 : 0.6,
        color: sameGroup ? srcGroup!.color : tc.borderSubtle,
      },
    };
  });

  return {
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: tc.bgElevated,
      borderColor: tc.border,
      textStyle: { color: tc.text, fontSize: 12 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const d = params.data;
        if (d.filePath) {
          return [
            `<div style="font-size:13px">`,
            `<strong>${d.filePath}</strong><br/>`,
            `<span style="color:${tc.textSecondary}">语言:</span> ${d.language}<br/>`,
            `<span style="color:${tc.textSecondary}">行数:</span> ${d.lineCount}<br/>`,
            `<span style="color:${tc.textSecondary}">被引用:</span> ${d.inDegree} 次`,
            `</div>`,
          ].join('');
        }
        if (d.importPath) {
          return `<span style="font-size:12px">${d.importPath}</span>`;
        }
        return '';
      },
    },
    series: [{
      type: 'graph' as const,
      layout: positions ? 'none' as const : 'force' as const,
      roam: true,
      draggable: !positions,
      force: {
        repulsion: 200,
        edgeLength: [80, 200],
        gravity: 0.1,
      },
      data: chartNodes,
      links: chartEdges,
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: 6,
      label: {
        position: 'right' as const,
        fontSize: 10,
        color: tc.textSecondary,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (p: any) => p.data.fileName || '',
      },
      emphasis: {
        focus: 'adjacency' as const,
        lineStyle: { width: 2, color: tc.primary },
      },
      lineStyle: {
        opacity: 0.6,
        curveness: 0.3,
        color: tc.borderSubtle,
      },
      animationDuration: 800,
      animationEasingUpdate: 'quinticInOut' as const,
    }],
  };
}

export function buildImpactOption(
  graphData: GraphData,
  impactResult: ImpactResult,
  selectedNodeIds: Set<string>,
  tc: ReturnType<typeof getThemeColors>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const impactedIds = new Set(impactResult.impactedNodes.map(n => n.id));
  const depthMap = new Map(impactResult.impactedNodes.map(n => [n.id, n.depth]));

  const IMPACT_COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b'];

  const chartNodes = graphData.nodes.map(n => {
    const isSelected = selectedNodeIds.has(n.id);
    const isImpacted = impactedIds.has(n.id);
    const depth = depthMap.get(n.id);
    const isDimmed = !isSelected && !isImpacted;

    let color = tc.textTertiary || '#ccc';
    let borderColor: string | undefined;
    let borderWidth = 0;
    let symbolSize = 8;

    if (isSelected) {
      color = '#e74c3c';
      borderColor = '#c0392b';
      borderWidth = 3;
      symbolSize = 20;
    } else if (isImpacted) {
      color = IMPACT_COLORS[Math.min(depth ?? 0, 2)];
      symbolSize = Math.max(10, 16 - (depth ?? 0) * 2);
    }

    return {
      id: n.id,
      name: n.filePath,
      symbolSize,
      itemStyle: {
        color,
        opacity: isDimmed ? 0.1 : 1,
        borderColor,
        borderWidth,
      },
      label: {
        show: isSelected || (isImpacted && (depth ?? 0) <= 1),
        fontSize: 10,
      },
      filePath: n.filePath,
      fileName: n.fileName,
      depth: depthMap.get(n.id),
    };
  });

  const chartEdges = graphData.edges.map(e => ({
    source: e.sourceNodeId,
    target: e.targetNodeId,
    lineStyle: {
      width: 1,
      opacity: 0.15,
      color: tc.borderSubtle,
    },
  }));

  return {
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: tc.bgElevated,
      borderColor: tc.border,
      textStyle: { color: tc.text, fontSize: 12 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const d = params.data;
        if (d.filePath) {
          const depth = d.depth;
          const label = depth !== undefined ? `影响深度: ${depth} 层` : selectedNodeIds.has(d.id) ? '选中文件' : '';
          return `<strong>${d.filePath}</strong><br/>${label}`;
        }
        return '';
      },
    },
    series: [{
      type: 'graph' as const,
      layout: 'force' as const,
      roam: true,
      draggable: true,
      force: { repulsion: 200, edgeLength: [80, 200], gravity: 0.1 },
      data: chartNodes,
      links: chartEdges,
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: 6,
      label: { position: 'right' as const, fontSize: 10, color: tc.textSecondary },
      emphasis: { focus: 'adjacency' as const },
      lineStyle: { opacity: 0.15, curveness: 0.3, color: tc.borderSubtle },
      animationDuration: 600,
    }],
  };
}

export function buildChainOption(
  graphData: GraphData,
  chainResult: ChainResult,
  tc: ReturnType<typeof getThemeColors>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const chainNodeIds = new Set(chainResult.chainNodes.map(n => n.id));
  const depthMap = new Map(chainResult.chainNodes.map(n => [n.id, n.depth]));
  const chainEdgeKeys = new Set(
    chainResult.chainEdges.map(e => `${e.sourceId}->${e.targetId}`)
  );

  const chartNodes = graphData.nodes.map(n => {
    const inChain = chainNodeIds.has(n.id);
    const depth = depthMap.get(n.id);
    const isRoot = depth === 0;

    return {
      id: n.id,
      name: n.filePath,
      symbolSize: isRoot ? 22 : inChain ? Math.max(10, 18 - (depth ?? 0)) : 6,
      itemStyle: {
        color: isRoot ? '#e74c3c' : inChain ? '#3498db' : (tc.textTertiary || '#ccc'),
        opacity: inChain ? 1 : 0.08,
      },
      label: {
        show: inChain && (depth ?? 0) <= 3,
        fontSize: 10,
      },
      filePath: n.filePath,
      fileName: n.fileName,
      depth,
    };
  });

  const chartEdges = graphData.edges.map(e => {
    const key = `${e.sourceNodeId}->${e.targetNodeId}`;
    const isInChain = chainEdgeKeys.has(key);

    return {
      source: e.sourceNodeId,
      target: e.targetNodeId,
      lineStyle: {
        width: isInChain ? 2 : 1,
        opacity: isInChain ? 0.8 : 0.05,
        color: isInChain ? '#3498db' : tc.borderSubtle,
        type: isInChain ? 'solid' as const : 'dashed' as const,
      },
    };
  });

  return {
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: tc.bgElevated,
      borderColor: tc.border,
      textStyle: { color: tc.text, fontSize: 12 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const d = params.data;
        if (d.filePath) {
          const depth = d.depth;
          return `<strong>${d.filePath}</strong><br/>深度: ${depth ?? '-'}`;
        }
        return '';
      },
    },
    series: [{
      type: 'graph' as const,
      layout: 'force' as const,
      roam: true,
      draggable: true,
      force: { repulsion: 200, edgeLength: [80, 200], gravity: 0.1 },
      data: chartNodes,
      links: chartEdges,
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: 6,
      label: { position: 'right' as const, fontSize: 10, color: tc.textSecondary },
      emphasis: { focus: 'adjacency' as const },
      lineStyle: { opacity: 0.3, curveness: 0.3 },
      animationDuration: 600,
    }],
  };
}

export function buildLayersOption(
  graphData: GraphData,
  layerResult: LayerResult,
  tc: ReturnType<typeof getThemeColors>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const { layers, cycles } = layerResult;
  const cycleNodeIds = new Set(cycles.flatMap(c => c.nodeIds));

  const LAYER_COLORS = [
    '#3498db', '#2ecc71', '#e67e22', '#9b59b6', '#1abc9c',
    '#e74c3c', '#f1c40f', '#00cec9', '#6c5ce7', '#e84393',
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartNodes: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartEdges: any[] = [];

  const layerGap = Math.max(120, 800 / Math.max(layers.length, 1));

  layers.forEach((layer, layerIdx) => {
    const y = 60 + layerIdx * layerGap;
    const nodeGap = Math.max(80, 1200 / Math.max(layer.nodes.length, 1));
    const startX = -(layer.nodes.length - 1) * nodeGap / 2;
    const color = LAYER_COLORS[layerIdx % LAYER_COLORS.length];

    layer.nodes.forEach((node, nodeIdx) => {
      const x = startX + nodeIdx * nodeGap;

      chartNodes.push({
        id: node.id,
        name: node.filePath,
        x,
        y,
        fixed: true,
        symbolSize: 14,
        itemStyle: {
          color: cycleNodeIds.has(node.id) ? '#e74c3c' : color,
          borderColor: cycleNodeIds.has(node.id) ? '#c0392b' : undefined,
          borderWidth: cycleNodeIds.has(node.id) ? 2 : 0,
        },
        label: { show: layer.nodes.length <= 20, fontSize: 9 },
        filePath: node.filePath,
        fileName: node.fileName,
      });
    });
  });

  // Build inter-layer edges from the actual graph
  const nodeLayerMap = new Map<string, number>();
  layers.forEach((layer, layerIdx) => {
    for (const node of layer.nodes) {
      nodeLayerMap.set(node.id, layerIdx);
    }
  });

  for (const e of graphData.edges) {
    const srcLayer = nodeLayerMap.get(e.sourceNodeId);
    const tgtLayer = nodeLayerMap.get(e.targetNodeId);
    if (srcLayer !== undefined && tgtLayer !== undefined && srcLayer !== tgtLayer) {
      chartEdges.push({
        source: e.sourceNodeId,
        target: e.targetNodeId,
        lineStyle: {
          width: srcLayer > tgtLayer ? 2 : 1,
          opacity: srcLayer > tgtLayer ? 0.7 : 0.3,
          color: srcLayer > tgtLayer ? '#e74c3c' : tc.borderSubtle,
          type: srcLayer > tgtLayer ? 'dashed' as const : 'solid' as const,
        },
      });
    }
  }

  return {
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: tc.bgElevated,
      borderColor: tc.border,
      textStyle: { color: tc.text, fontSize: 12 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const d = params.data;
        if (d.filePath) {
          return `<strong>${d.filePath}</strong>`;
        }
        return '';
      },
    },
    graphic: layers.map((_layer, idx) => ({
      type: 'text' as const,
      left: 16,
      top: 60 + idx * layerGap - 10,
      style: {
        text: `Layer ${idx}`,
        fill: tc.textSecondary,
        fontSize: 11,
        fontWeight: 600,
      },
    })),
    series: [{
      type: 'graph' as const,
      layout: 'none' as const,
      roam: true,
      draggable: false,
      data: chartNodes,
      links: chartEdges,
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: 5,
      label: { position: 'right' as const, fontSize: 9, color: tc.textSecondary },
      emphasis: { focus: 'adjacency' as const },
      lineStyle: { opacity: 0.4, curveness: 0.2, color: tc.borderSubtle },
      animationDuration: 600,
    }],
  };
}
