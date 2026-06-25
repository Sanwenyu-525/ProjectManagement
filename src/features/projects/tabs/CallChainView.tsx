import { useState, useMemo, useCallback } from 'react';
import { Select, Statistic, Spin } from 'antd';
import { BranchesOutlined, SwapOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { getThemeColors } from '../../../lib/themeColors';
import { useTraceChain } from '../../../hooks/useProjects';
import { buildChainOption } from './graphLayouts';
import type { GraphData, ChainResult } from '../../../types';

interface CallChainViewProps {
  graphData: GraphData;
  projectId: string;
}

export default function CallChainView({ graphData, projectId }: CallChainViewProps) {
  const tc = getThemeColors();
  const chainMutation = useTraceChain(projectId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [chainResult, setChainResult] = useState<ChainResult | null>(null);

  const nodeOptions = useMemo(() =>
    graphData.nodes
      .slice(0, 500)
      .map(n => ({ label: n.filePath, value: n.id })),
    [graphData]
  );

  const handleTrace = useCallback(async (nodeId: string, dir: 'forward' | 'backward') => {
    setSelectedNodeId(nodeId);
    setDirection(dir);
    try {
      const result = await chainMutation.mutateAsync({ nodeId, direction: dir });
      setChainResult(result);
    } catch {
      // error handled by mutation state
    }
  }, [chainMutation]);

  const handleDirectionToggle = useCallback(() => {
    if (selectedNodeId) {
      const newDir = direction === 'forward' ? 'backward' : 'forward';
      handleTrace(selectedNodeId, newDir);
    }
  }, [selectedNodeId, direction, handleTrace]);

  const option = useMemo(() => {
    if (!chainResult) return null;
    return buildChainOption(graphData, chainResult, tc);
  }, [graphData, chainResult, tc]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        marginBottom: 8,
        background: tc.bgElevated,
        borderRadius: 8,
        border: `1px solid ${tc.border}`,
        flexShrink: 0,
      }}>
        <BranchesOutlined style={{ color: tc.primary }} />
        <Select
          showSearch
          placeholder="选择入口文件"
          style={{ flex: 1, maxWidth: 400 }}
          options={nodeOptions}
          value={selectedNodeId}
          onChange={(val) => handleTrace(val, direction)}
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
          }
          size="small"
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 6,
            border: `1px solid ${tc.border}`,
            cursor: selectedNodeId ? 'pointer' : 'not-allowed',
            opacity: selectedNodeId ? 1 : 0.5,
            fontSize: 12,
            color: tc.text,
          }}
          onClick={handleDirectionToggle}
        >
          <SwapOutlined style={{ fontSize: 12 }} />
          {direction === 'forward' ? '正向: 我依赖谁' : '反向: 谁依赖我'}
        </div>
        {chainResult && (
          <>
            <Statistic
              title="节点数"
              value={chainResult.chainNodes.length}
              valueStyle={{ fontSize: 14 }}
            />
            <Statistic
              title="最大深度"
              value={chainResult.maxDepth}
              valueStyle={{ fontSize: 14 }}
            />
          </>
        )}
      </div>

      {/* Graph */}
      {!option ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', flex: 1, gap: 16,
        }}>
          <BranchesOutlined style={{ fontSize: 48, color: tc.primary }} />
          <div style={{ color: tc.textSecondary, fontSize: 13 }}>
            选择一个入口文件，查看其依赖调用链
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 400 }}>
          {chainMutation.isPending ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Spin size="large" />
            </div>
          ) : (
            <ReactECharts
              option={option}
              style={{ height: '100%', minHeight: 400 }}
              opts={{ renderer: 'canvas' }}
              notMerge={true}
            />
          )}
        </div>
      )}
    </div>
  );
}
