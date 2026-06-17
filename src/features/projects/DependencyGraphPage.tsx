import { useState, useRef, useMemo } from 'react';
import { Typography, Spin, Empty, Button, Space } from 'antd';
import { ReloadOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useProjects } from '../../hooks/useProjects';
import { dependenciesApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import { getThemeColors } from '../../lib/themeColors';
import { useThemeStore } from '../../stores/themeStore';

const { Title } = Typography;

interface GraphNode {
  id: string;
  name: string;
  x: number;
  y: number;
  techStack: string[];
  status: string;
  dependsOn: string[];
}

interface GraphEdge {
  from: string;
  to: string;
}

const STATUS_COLORS: Record<string, string> = {
  Idea: '#9eadc0',
  Planning: '#6366f1',
  Active: '#22c55e',
  Completed: '#3b82f6',
  Archived: '#9eadc0',
};

const computeLayout = (nodeCount: number, isCompact: boolean) => {
  const cols = Math.ceil(Math.sqrt(nodeCount || 1));
  const nodeWidth = isCompact ? 120 : 180;
  const nodeHeight = isCompact ? 60 : 80;
  const gapX = isCompact ? 40 : 60;
  const gapY = isCompact ? 40 : 60;
  const svgWidth = Math.max(600, cols * (nodeWidth + gapX) + 120);
  const svgHeight = Math.max(400, Math.ceil(nodeCount / cols) * (nodeHeight + gapY) + 120);
  return { cols, nodeWidth, nodeHeight, gapX, gapY, svgWidth, svgHeight };
};

export default function DependencyGraphPage() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const mode = useThemeStore(s => s.mode);
  const tc = useMemo(() => getThemeColors(), [mode]);
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);

  const { data: depGraph } = useQuery({
    queryKey: queryKeys.dependencies.graph(projectIds),
    queryFn: () => dependenciesApi.detect(projectIds),
    enabled: projectIds.length > 0,
  });

  const { nodes, edges } = useMemo(() => {
    if (projects.length === 0) return { nodes: [], edges: [] };

    let detectedEdges: GraphEdge[] = [];
    const dep = depGraph as { edges?: Array<{ from: string; to: string }> } | null;
    if (dep?.edges) {
      detectedEdges = dep.edges.map((e) => ({ from: e.from, to: e.to }));
    }

    // Fallback: infer edges from shared tech stack and path proximity
    if (detectedEdges.length === 0) {
      for (let i = 0; i < projects.length; i++) {
        for (let j = i + 1; j < projects.length; j++) {
          const a = projects[i];
          const b = projects[j];
          // Same parent directory → likely related
          if (a.localPath && b.localPath) {
            const parentA = a.localPath.replace(/[\\/][^/\\]+$/, '');
            const parentB = b.localPath.replace(/[\\/][^/\\]+$/, '');
            if (parentA === parentB && a.localPath !== b.localPath) {
              detectedEdges.push({ from: a.id, to: b.id });
            }
          }
        }
      }
    }

    // Layout: simple grid
    const lyt = computeLayout(projects.length, compact);
    const graphNodes: GraphNode[] = projects.map((p, i) => ({
      id: p.id,
      name: p.name,
      x: (i % lyt.cols) * (lyt.nodeWidth + lyt.gapX) + 60,
      y: Math.floor(i / lyt.cols) * (lyt.nodeHeight + lyt.gapY) + 60,
      techStack: p.techStack || [],
      status: p.status || 'Idea',
      dependsOn: detectedEdges.filter(e => e.from === p.id).map(e => e.to),
    }));

    return { nodes: graphNodes, edges: detectedEdges };
  }, [projects, depGraph, compact]);

  const { nodeWidth, nodeHeight, svgWidth, svgHeight } = computeLayout(nodes.length, compact);

  const getConnectedIds = (nodeId: string): Set<string> => {
    const connected = new Set<string>();
    connected.add(nodeId);
    for (const edge of edges) {
      if (edge.from === nodeId) connected.add(edge.to);
      if (edge.to === nodeId) connected.add(edge.from);
    }
    return connected;
  };

  const connectedIds = hoveredNode ? getConnectedIds(hoveredNode) : null;

  if (projectsLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return <Empty description="暂无项目" style={{ padding: 60 }} />;
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>项目关系图</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }); queryClient.invalidateQueries({ queryKey: queryKeys.dependencies.graph(projectIds) }); }}>刷新</Button>
          <Button
            icon={compact ? <ExpandOutlined /> : <CompressOutlined />}
            onClick={() => setCompact(!compact)}
          >
            {compact ? '展开' : '紧凑'}
          </Button>
        </Space>
      </div>

      <div style={{
        background: 'var(--color-bg-card)',
        borderRadius: 12,
        border: '1px solid var(--color-border)',
        overflow: 'auto',
        padding: 16,
      }}>
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          style={{ display: 'block', margin: '0 auto' }}
        >
          {/* Edges */}
          {edges.map((edge, i) => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const x1 = fromNode.x + nodeWidth / 2;
            const y1 = fromNode.y + nodeHeight / 2;
            const x2 = toNode.x + nodeWidth / 2;
            const y2 = toNode.y + nodeHeight / 2;

            const isHighlighted = hoveredNode && (connectedIds?.has(edge.from) && connectedIds?.has(edge.to));
            const isDimmed = hoveredNode && !isHighlighted;

            return (
              <g key={i}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isHighlighted ? tc.statusDone : tc.border}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={isDimmed ? '4,4' : 'none'}
                  opacity={isDimmed ? 0.2 : 1}
                  markerEnd="url(#arrow)"
                />
              </g>
            );
          })}

          {/* Arrow marker */}
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={tc.textLight} />
            </marker>
          </defs>

          {/* Nodes */}
          {nodes.map((node) => {
            const isDimmed = hoveredNode && !connectedIds?.has(node.id) && hoveredNode !== node.id;
            const isHovered = hoveredNode === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ cursor: 'pointer', opacity: isDimmed ? 0.2 : 1 }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => window.location.hash = `#/projects/${node.id}`}
              >
                {/* Card background */}
                <rect
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={10}
                  ry={10}
                  fill={isHovered ? tc.statusDone : tc.bgCard}
                  stroke={isHovered ? tc.statusDone : (STATUS_COLORS[node.status] || tc.border)}
                  strokeWidth={isHovered ? 2 : 1.5}
                  filter={isHovered ? 'url(#shadow)' : undefined}
                />

                {/* Status dot */}
                <circle
                  cx={nodeWidth - 12}
                  cy={12}
                  r={5}
                  fill={STATUS_COLORS[node.status] || tc.textLight}
                />

                {/* Icon placeholder */}
                <text x={12} y={compact ? 28 : 32} fontSize={compact ? 14 : 16} fill={tc.text} fontWeight="600">
                  {node.name.length > (compact ? 10 : 16) ? node.name.slice(0, compact ? 10 : 16) + '…' : node.name}
                </text>

                {/* Tech stack */}
                {!compact && node.techStack.length > 0 && (
                  <text x={12} y={55} fontSize={10} fill={tc.textDescription}>
                    {node.techStack.slice(0, 3).join(', ')}
                  </text>
                )}

                {/* Depends count */}
                {node.dependsOn.length > 0 && (
                  <text x={nodeWidth - 12} y={nodeHeight - 8} fontSize={9} fill={tc.textDescription} textAnchor="end">
                    → {node.dependsOn.length}
                  </text>
                )}
              </g>
            );
          })}

          {/* Shadow filter */}
          <defs>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
            </filter>
          </defs>
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => {
          const labelMap: Record<string, string> = {
            Idea: '构思', Planning: '规划中', Active: '进行中', Completed: '已完成', Archived: '已归档',
          };
          return (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-description)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              {labelMap[status] || status}
            </div>
          );
        })}
      </div>
    </div>
  );
}
