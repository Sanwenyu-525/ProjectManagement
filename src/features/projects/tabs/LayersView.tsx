import { useMemo } from 'react';
import { Spin, Empty, Tag, Alert, Statistic } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { getThemeColors } from '../../../lib/themeColors';
import { buildLayersOption } from './graphLayouts';
import type { GraphData, LayerResult } from '../../../types';

interface LayersViewProps {
  graphData: GraphData;
  layerResult: LayerResult | undefined;
  isLoading: boolean;
}

export default function LayersView({ graphData, layerResult, isLoading }: LayersViewProps) {
  const tc = getThemeColors();

  const option = useMemo(() => {
    if (!layerResult) return null;
    return buildLayersOption(graphData, layerResult, tc);
  }, [graphData, layerResult, tc]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!layerResult || layerResult.layers.length === 0) {
    return <Empty description="无法计算架构分层" style={{ marginTop: 80 }} />;
  }

  const hasCycle = layerResult.cycles.length > 0;
  const cycleNodeCount = layerResult.cycles.reduce((sum, c) => sum + c.nodeIds.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Stats */}
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
          title="层数"
          value={layerResult.layers.length}
          valueStyle={{ fontSize: 16, color: tc.primary }}
        />
        <Statistic
          title="总节点"
          value={layerResult.totalNodes}
          valueStyle={{ fontSize: 16, color: tc.text }}
        />
        {hasCycle && (
          <Tag color="error" icon={<WarningOutlined />}>
            检测到循环依赖: {cycleNodeCount} 个文件
          </Tag>
        )}
      </div>

      {/* Cycle warning */}
      {hasCycle && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="循环依赖检测"
          description={
            <div>
              {layerResult.cycles.map((cycle, idx) => (
                <div key={idx}>
                  {cycle.filePaths.slice(0, 5).map(fp => (
                    <Tag key={fp} color="error" style={{ margin: '2px' }}>{fp}</Tag>
                  ))}
                  {cycle.filePaths.length > 5 && (
                    <Tag style={{ margin: '2px' }}>+{cycle.filePaths.length - 5} more</Tag>
                  )}
                </div>
              ))}
            </div>
          }
          style={{ marginBottom: 8, flexShrink: 0 }}
        />
      )}

      {/* Graph */}
      <div style={{ flex: 1, minHeight: 400 }}>
        {option && (
          <ReactECharts
            option={option}
            style={{ height: '100%', minHeight: 400 }}
            opts={{ renderer: 'canvas' }}
            notMerge={true}
          />
        )}
      </div>
    </div>
  );
}
