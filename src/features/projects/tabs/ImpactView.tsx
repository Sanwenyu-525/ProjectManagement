import { useState, useMemo, useCallback } from 'react';
import { Statistic, message, Spin } from 'antd';
import { ThunderboltOutlined, FolderOpenOutlined, RobotOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { getThemeColors } from '../../../lib/themeColors';
import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { useComputeImpact } from '../../../hooks/useProjects';
import { buildImpactOption } from './graphLayouts';
import type { GraphData, ImpactResult, Project } from '../../../types';

interface ImpactViewProps {
  graphData: GraphData;
  projectId: string;
  project?: Project;
}

export default function ImpactView({ graphData, projectId, project }: ImpactViewProps) {
  const tc = getThemeColors();
  const navigate = useNavigate();
  const impactMutation = useComputeImpact(projectId);
  const requestOpenFile = useWorkspaceStore(s => s.requestOpenFile);
  const setPendingAgentMsg = useWorkspaceStore(s => s.setPendingAgentMessage);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);

  const handleNodeClick = useCallback(async (nodeId: string) => {
    const newSelected = new Set(selectedNodeIds);
    if (newSelected.has(nodeId)) {
      newSelected.delete(nodeId);
    } else {
      newSelected.add(nodeId);
    }
    setSelectedNodeIds(newSelected);

    if (newSelected.size === 0) {
      setImpactResult(null);
      return;
    }

    try {
      const result = await impactMutation.mutateAsync(Array.from(newSelected));
      setImpactResult(result);
    } catch {
      message.error('影响分析失败');
    }
  }, [selectedNodeIds, impactMutation]);

  // Base option: all nodes dimmed but visible, clickable
  const baseOption = useMemo(() => {
    const chartNodes = graphData.nodes.map(n => ({
      id: n.id,
      name: n.filePath,
      symbolSize: 14,
      itemStyle: { color: tc.primary, opacity: 0.4 },
      label: { show: false },
      filePath: n.filePath,
      fileName: n.fileName,
    }));
    const chartEdges = graphData.edges.map(e => ({
      source: e.sourceNodeId,
      target: e.targetNodeId,
      lineStyle: { width: 1, opacity: 0.1, color: tc.borderSubtle },
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
          if (d.filePath) return `<strong>${d.filePath}</strong><br/>点击选择此文件`;
          return '';
        },
      },
      series: [{
        type: 'graph' as const,
        layout: 'force' as const,
        roam: true,
        draggable: false,
        layoutAnimation: false,
        force: { repulsion: 300, edgeLength: [100, 250], gravity: 0.15, friction: 0.8 },
        data: chartNodes,
        links: chartEdges,
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: 6,
        label: { position: 'right' as const, fontSize: 10, color: tc.textSecondary },
        emphasis: { focus: 'adjacency' as const, lineStyle: { width: 2 } },
        lineStyle: { opacity: 0.1, curveness: 0.3, color: tc.borderSubtle },
        animationDuration: 600,
      }],
    };
  }, [graphData, tc]);

  const impactOption = useMemo(() => {
    if (!impactResult) return null;
    return buildImpactOption(graphData, impactResult, selectedNodeIds, tc);
  }, [graphData, impactResult, selectedNodeIds, tc]);

  const option = impactOption || baseOption;

  const handleChartClick = useCallback((params: { data?: { id?: string } }) => {
    if (params.data?.id) {
      handleNodeClick(params.data.id);
    }
  }, [handleNodeClick]);

  const events = useMemo(() => ({
    click: handleChartClick,
  }), [handleChartClick]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Stats bar */}
      {impactResult && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          padding: '8px 12px',
          marginBottom: 8,
          background: tc.bgElevated,
          borderRadius: 8,
          border: `1px solid ${tc.border}`,
          flexShrink: 0,
        }}>
          <Statistic
            title="选中文件"
            value={selectedNodeIds.size}
            valueStyle={{ fontSize: 16, color: '#e74c3c' }}
          />
          <Statistic
            title="直接影响"
            value={impactResult.directCount}
            valueStyle={{ fontSize: 16, color: '#ffa94d' }}
            suffix="个文件"
          />
          <Statistic
            title="间接影响"
            value={impactResult.indirectCount}
            valueStyle={{ fontSize: 16, color: '#ffd43b' }}
            suffix="个文件"
          />
          <Statistic
            title="最大深度"
            value={impactResult.maxDepth}
            valueStyle={{ fontSize: 16, color: tc.text }}
            suffix="层"
          />
          <div style={{ flex: 1 }} />
          {/* Action buttons for selected nodes */}
          {selectedNodeIds.size === 1 && (() => {
            const selectedId = Array.from(selectedNodeIds)[0];
            const node = graphData.nodes.find(n => n.id === selectedId);
            const fp = node?.filePath;
            return fp ? (
              <>
                <div
                  onClick={() => {
                    const fullPath = project?.localPath ? `${project.localPath}/${fp}` : fp;
                    requestOpenFile(fullPath);
                    navigate('/');
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 6,
                    border: `1px solid ${tc.border}`,
                    cursor: 'pointer', fontSize: 12, color: tc.text,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = tc.primaryBg || 'rgba(0,0,0,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <FolderOpenOutlined style={{ fontSize: 12 }} /> 打开文件
                </div>
                <div
                  onClick={() => {
                    setPendingAgentMsg(`分析这个文件的代码，给出架构分析和改进建议：${fp}`);
                    navigate('/');
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 6,
                    border: `1px solid ${tc.border}`,
                    cursor: 'pointer', fontSize: 12, color: tc.text,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = tc.primaryBg || 'rgba(0,0,0,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <RobotOutlined style={{ fontSize: 12 }} /> 交给 Agent
                </div>
              </>
            ) : null;
          })()}
          <span
            style={{ fontSize: 12, color: tc.textSecondary, cursor: 'pointer' }}
            onClick={() => {
              setSelectedNodeIds(new Set());
              setImpactResult(null);
            }}
          >
            清除选择
          </span>
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '4px 12px',
        marginBottom: 4,
        flexShrink: 0,
      }}>
        <ThunderboltOutlined style={{ color: tc.primary }} />
        <span style={{ fontSize: 12, color: tc.textSecondary }}>点击节点选择文件，查看影响范围</span>
      </div>

      {/* Graph */}
      <div style={{ flex: 1, minHeight: 400 }}>
        {impactMutation.isPending ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Spin size="large" />
          </div>
        ) : (
          <ReactECharts
            option={option}
            style={{ height: '100%', minHeight: 400 }}
            opts={{ renderer: 'canvas' }}
            notMerge={true}
            onEvents={events}
          />
        )}
      </div>
    </div>
  );
}
