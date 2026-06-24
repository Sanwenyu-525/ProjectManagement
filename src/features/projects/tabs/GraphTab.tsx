import { useState, useMemo, useCallback } from 'react';
import {
  Button, Spin, Empty, Space, Tag, message, Statistic,
  List, Tooltip, Popconfirm, Modal, Form, Input, Badge,
  Checkbox, Segmented,
} from 'antd';
import {
  ReloadOutlined, ApartmentOutlined, GroupOutlined,
  PlusOutlined, DeleteOutlined, EyeOutlined, EyeInvisibleOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { getThemeColors } from '../../../lib/themeColors';
import {
  useProjectGraph, useProjectGraphStats, useScanProjectGraph,
  useFeatureGroups, useGroupMemberships,
  useCreateFeatureGroup, useDeleteFeatureGroup,
  useAddFilesToGroup, useRemoveFileFromGroup,
  useSuggestGroups,
} from '../../../hooks/useProjects';
import type { GraphData, GraphSummary, FeatureGroup, SuggestedGroup } from '../../../types';

type LayoutType = 'force' | 'tree' | 'concentric' | 'matrix';

const LAYOUT_OPTIONS = [
  { label: '力导向', value: 'force' },
  { label: '层次', value: 'tree' },
  { label: '同心圆', value: 'concentric' },
  { label: '矩阵', value: 'matrix' },
];

const LANGUAGE_COLORS: Record<string, string> = {
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

const GROUP_PALETTE = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e84393', '#00cec9', '#6c5ce7',
];

interface GroupColorInfo {
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

  // BFS layering
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
  // Disconnected nodes
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

  // Sort nodes: topological layers first, then by directory
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

function buildGraphOption(
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

export default function GraphTab({ projectId }: { projectId: string }) {
  const tc = getThemeColors();
  const { data: graphData, isLoading, refetch } = useProjectGraph(projectId);
  const { data: stats } = useProjectGraphStats(projectId);
  const scanMutation = useScanProjectGraph(projectId);

  // Feature groups
  const { data: featureGroups } = useFeatureGroups(projectId);
  const { data: memberships } = useGroupMemberships(projectId);
  const createGroup = useCreateFeatureGroup(projectId);
  const deleteGroup = useDeleteFeatureGroup(projectId);
  const addFilesMutation = useAddFilesToGroup(projectId);
  const removeFileMutation = useRemoveFileFromGroup(projectId);
  const suggestMutation = useSuggestGroups(projectId);

  const [groupsPanelOpen, setGroupsPanelOpen] = useState(false);
  const [layoutType, setLayoutType] = useState<LayoutType>('force');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [suggestResults, setSuggestResults] = useState<SuggestedGroup[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<number[]>([]);
  const [createForm] = Form.useForm();
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Build nodeId -> GroupColorInfo map
  const nodeColorMap = useMemo(() => {
    const map = new Map<string, GroupColorInfo>();
    if (memberships && featureGroups) {
      const groupColorLookup = new Map<string, string>();
      for (const g of featureGroups) {
        if (g.color) groupColorLookup.set(g.id, g.color);
      }
      for (const m of memberships) {
        const color = groupColorLookup.get(m.groupId) || m.color || GROUP_PALETTE[0];
        map.set(m.nodeId, { color, groupId: m.groupId });
      }
    }
    return map;
  }, [memberships, featureGroups]);

  const handleScan = async () => {
    try {
      const summary: GraphSummary = await scanMutation.mutateAsync();
      message.success(`扫描完成: ${summary.nodeCount} 个文件, ${summary.edgeCount} 条依赖 (${summary.scanDurationMs}ms)`);
    } catch {
      message.error('图谱扫描失败');
    }
  };

  const option = useMemo(() => {
    if (!graphData) return null;
    return buildGraphOption(graphData, tc, nodeColorMap, selectedGroupId, layoutType);
  }, [graphData, tc, nodeColorMap, selectedGroupId, layoutType]);

  const handleCreateGroup = async () => {
    try {
      const values = await createForm.validateFields();
      const colorIndex = (featureGroups?.length ?? 0) % GROUP_PALETTE.length;
      await createGroup.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        color: values.color || GROUP_PALETTE[colorIndex],
      });
      createForm.resetFields();
      setCreateModalOpen(false);
      message.success('功能组已创建');
    } catch {
      // validation error or mutation error
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await deleteGroup.mutateAsync(groupId);
      if (selectedGroupId === groupId) setSelectedGroupId(null);
      message.success('功能组已删除');
    } catch {
      message.error('删除失败');
    }
  };

  const handleSuggest = async () => {
    setSuggestLoading(true);
    try {
      const results = await suggestMutation.mutateAsync();
      setSuggestResults(results);
      setSelectedSuggestions(results.map((_, i) => i));
      setSuggestModalOpen(true);
    } catch {
      message.error('推荐失败');
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleAcceptSuggestions = async () => {
    const toCreate = selectedSuggestions.map(i => suggestResults[i]).filter(Boolean);
    for (const sg of toCreate) {
      try {
        const colorIdx = ((featureGroups?.length ?? 0) + toCreate.indexOf(sg)) % GROUP_PALETTE.length;
        const group = await createGroup.mutateAsync({
          name: sg.name,
          description: sg.reason,
          color: GROUP_PALETTE[colorIdx],
        });
        if (sg.nodeIds.length > 0) {
          await addFilesMutation.mutateAsync({ groupId: group.id, nodeIds: sg.nodeIds });
        }
      } catch {
        // skip failed ones
      }
    }
    setSuggestModalOpen(false);
    message.success(`已创建 ${toCreate.length} 个功能组`);
  };

  // Get nodeIds for a specific group from memberships
  const getGroupNodeIds = useCallback((groupId: string): Set<string> => {
    const set = new Set<string>();
    if (memberships) {
      for (const m of memberships) {
        if (m.groupId === groupId) set.add(m.nodeId);
      }
    }
    return set;
  }, [memberships]);

  const selectedGroupNodeIds = useMemo(
    () => selectedGroupId ? getGroupNodeIds(selectedGroupId) : new Set<string>(),
    [selectedGroupId, getGroupNodeIds],
  );

  // NodeId -> filePath map
  const nodeIdToPath = useMemo(() => {
    const map = new Map<string, string>();
    if (graphData) {
      for (const n of graphData.nodes) {
        map.set(n.id, n.filePath);
      }
    }
    return map;
  }, [graphData]);

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  }

  const hasData = graphData && graphData.nodes.length > 0;

  // Groups panel border color
  const panelBg = tc.bgElevated || 'rgba(255,255,255,0.92)';
  const panelBorder = tc.border || 'rgba(0,0,0,0.06)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexShrink: 0,
      }}>
        <Space>
          <Button
            type="primary"
            icon={<ApartmentOutlined />}
            onClick={handleScan}
            loading={scanMutation.isPending}
          >
            {hasData ? '重新扫描' : '扫描项目'}
          </Button>
          {hasData && (
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              刷新
            </Button>
          )}
          <Button
            icon={<GroupOutlined />}
            type={groupsPanelOpen ? 'primary' : 'default'}
            onClick={() => setGroupsPanelOpen(!groupsPanelOpen)}
          >
            功能组
          </Button>
          {hasData && (
            <Segmented
              options={LAYOUT_OPTIONS}
              value={layoutType}
              onChange={(v) => setLayoutType(v as LayoutType)}
              size="small"
            />
          )}
        </Space>
        {stats && (
          <Space size="large">
            <Statistic
              title="文件数"
              value={stats.totalNodes}
              valueStyle={{ fontSize: 18, color: tc.text }}
            />
            <Statistic
              title="依赖关系"
              value={stats.totalEdges}
              valueStyle={{ fontSize: 18, color: tc.text }}
            />
            <Statistic
              title="孤立文件"
              value={stats.orphanFiles.length}
              valueStyle={{ fontSize: 18, color: tc.text }}
            />
          </Space>
        )}
      </div>

      {/* Main area: graph + groups panel */}
      {!hasData ? (
        <Empty
          description="尚未扫描项目依赖图谱"
          style={{ marginTop: 80 }}
        >
          <Button
            type="primary"
            icon={<ApartmentOutlined />}
            onClick={handleScan}
            loading={scanMutation.isPending}
          >
            开始扫描
          </Button>
        </Empty>
      ) : (
        <div style={{ display: 'flex', flex: 1, minHeight: 400, gap: 0 }}>
          {/* Graph */}
          <div style={{ flex: 1, minHeight: 400 }}>
            <ReactECharts
              option={option!}
              style={{ height: '100%', minHeight: 400 }}
              opts={{ renderer: 'canvas' }}
            />
          </div>

          {/* Groups panel */}
          {groupsPanelOpen && (
            <div style={{
              width: 280,
              flexShrink: 0,
              borderLeft: `1px solid ${panelBorder}`,
              background: panelBg,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              {/* Panel header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 12px 8px',
                borderBottom: `1px solid ${panelBorder}`,
              }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: tc.text }}>功能组</span>
                <Space size={4}>
                  <Tooltip title="智能推荐">
                    <Button
                      type="text"
                      size="small"
                      icon={<BulbOutlined />}
                      loading={suggestLoading}
                      onClick={handleSuggest}
                    />
                  </Tooltip>
                  <Tooltip title="新建功能组">
                    <Button
                      type="text"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => setCreateModalOpen(true)}
                    />
                  </Tooltip>
                </Space>
              </div>

              {/* Groups list */}
              <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
                {(!featureGroups || featureGroups.length === 0) ? (
                  <div style={{ padding: '24px 12px', textAlign: 'center', color: tc.textSecondary, fontSize: 13 }}>
                    暂无功能组
                  </div>
                ) : (
                  <List
                    size="small"
                    dataSource={featureGroups}
                    renderItem={(group: FeatureGroup) => (
                      <div
                        key={group.id}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          background: selectedGroupId === group.id ? (tc.primaryBg || 'rgba(0,0,0,0.03)') : 'transparent',
                          borderLeft: selectedGroupId === group.id ? `3px solid ${tc.primary}` : '3px solid transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            <div style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: group.color || GROUP_PALETTE[0],
                              flexShrink: 0,
                            }} />
                            <span style={{
                              fontWeight: 500,
                              fontSize: 13,
                              color: tc.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {group.name}
                            </span>
                            <Badge
                              count={group.fileCount}
                              style={{ backgroundColor: tc.textSecondary }}
                              size="small"
                            />
                          </div>
                          <Space size={0}>
                            <Tooltip title={selectedGroupId === group.id ? '取消聚焦' : '聚焦'}>
                              <Button
                                type="text"
                                size="small"
                                icon={selectedGroupId === group.id ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                                onClick={() => setSelectedGroupId(selectedGroupId === group.id ? null : group.id)}
                              />
                            </Tooltip>
                            <Popconfirm
                              title="确定删除此功能组？"
                              onConfirm={() => handleDeleteGroup(group.id)}
                              okText="删除"
                              cancelText="取消"
                            >
                              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Space>
                        </div>

                        {/* Group files when selected */}
                        {selectedGroupId === group.id && selectedGroupNodeIds.size > 0 && (
                          <div style={{ marginTop: 6, paddingLeft: 18 }}>
                            {Array.from(selectedGroupNodeIds).map(nodeId => (
                              <div
                                key={nodeId}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '2px 0',
                                  fontSize: 12,
                                  color: tc.textSecondary,
                                }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {nodeIdToPath.get(nodeId) || nodeId}
                                </span>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  style={{ flexShrink: 0 }}
                                  onClick={() => removeFileMutation.mutate({ groupId: group.id, nodeId })}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Language legend */}
      {stats && Object.keys(stats.languageBreakdown).length > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginTop: 12,
          flexShrink: 0,
        }}>
          {Object.entries(stats.languageBreakdown)
            .sort(([, a], [, b]) => b - a)
            .map(([lang, count]) => (
              <Tag key={lang} color={LANGUAGE_COLORS[lang] || tc.primary}>
                {lang} ({count})
              </Tag>
            ))
          }
        </div>
      )}

      {/* Create group modal */}
      <Modal
        title="新建功能组"
        open={createModalOpen}
        onOk={handleCreateGroup}
        onCancel={() => setCreateModalOpen(false)}
        okText="创建"
        cancelText="取消"
        confirmLoading={createGroup.isPending}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如: Auth、支付、用户管理" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="功能说明（可选）" />
          </Form.Item>
          <Form.Item name="color" label="颜色">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {GROUP_PALETTE.map(color => (
                <div
                  key={color}
                  onClick={() => createForm.setFieldsValue({ color })}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: color,
                    cursor: 'pointer',
                    border: createForm.getFieldValue('color') === color ? '3px solid #333' : '3px solid transparent',
                    transition: 'border-color 0.15s',
                  }}
                />
              ))}
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Suggest groups modal */}
      <Modal
        title="智能推荐功能组"
        open={suggestModalOpen}
        onOk={handleAcceptSuggestions}
        onCancel={() => setSuggestModalOpen(false)}
        okText={`创建选中的 (${selectedSuggestions.length})`}
        cancelText="取消"
        confirmLoading={createGroup.isPending}
        width={560}
      >
        {suggestResults.length === 0 ? (
          <Empty description="未发现可建议的分组" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {suggestResults.map((sg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '8px 12px',
                  border: `1px solid ${panelBorder}`,
                  borderRadius: 6,
                  background: selectedSuggestions.includes(i) ? (tc.primaryBg || 'rgba(0,0,0,0.02)') : 'transparent',
                }}
              >
                <Checkbox
                  checked={selectedSuggestions.includes(i)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSuggestions(prev => [...prev, i]);
                    } else {
                      setSelectedSuggestions(prev => prev.filter(x => x !== i));
                    }
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: tc.text }}>{sg.name}</div>
                  <div style={{ fontSize: 12, color: tc.textSecondary, marginTop: 2 }}>{sg.reason}</div>
                  <div style={{ fontSize: 11, color: tc.textSecondary, marginTop: 4 }}>
                    {sg.filePaths.length} 个文件
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
