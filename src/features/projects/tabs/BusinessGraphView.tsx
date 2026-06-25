import { useState, useMemo } from 'react';
import { Card, Tag, Empty, Button, Spin, Tooltip, Badge } from 'antd';
import { RobotOutlined, ApartmentOutlined } from '@ant-design/icons';
import { getThemeColors } from '../../../lib/themeColors';
import type { GraphData, BusinessModule } from '../../../types';

const MODULE_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e84393', '#00cec9', '#6c5ce7',
];

interface BusinessGraphViewProps {
  graphData: GraphData;
  modules: BusinessModule[] | null;
  loading: boolean;
  onAnalyze: () => void;
  selectedModuleIdx: number | null;
  onModuleSelect: (idx: number | null) => void;
}

export default function BusinessGraphView({
  graphData,
  modules,
  loading,
  onAnalyze,
  selectedModuleIdx,
  onModuleSelect,
}: BusinessGraphViewProps) {
  const tc = getThemeColors();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Build dependency graph for display
  const moduleDepsMap = useMemo(() => {
    if (!modules) return new Map<string, BusinessModule>();
    const map = new Map<string, BusinessModule>();
    for (const m of modules) {
      map.set(m.id, m);
    }
    return map;
  }, [modules]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400, gap: 16 }}>
        <Spin size="large" />
        <div style={{ color: tc.textSecondary, fontSize: 14 }}>AI 正在分析项目结构...</div>
        <div style={{ color: tc.textTertiary, fontSize: 12 }}>首次分析可能需要 30-60 秒</div>
      </div>
    );
  }

  if (!modules) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400, gap: 20 }}>
        <RobotOutlined style={{ fontSize: 48, color: tc.primary }} />
        <div style={{ color: tc.text, fontSize: 16, fontWeight: 500 }}>AI 业务图谱</div>
        <div style={{ color: tc.textSecondary, fontSize: 13, maxWidth: 360, textAlign: 'center', lineHeight: 1.6 }}>
          通过 AI 分析将 {graphData.nodes.length} 个文件自动归类为业务模块，帮助理解项目架构
        </div>
        <Button type="primary" icon={<ApartmentOutlined />} size="large" onClick={onAnalyze}>
          开始 AI 分析
        </Button>
      </div>
    );
  }

  if (modules.length === 0) {
    return <Empty description="AI 未识别到业务模块" style={{ marginTop: 80 }} />;
  }

  const cardBg = tc.glassStrong || tc.surface;
  const cardBorder = tc.border;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px 0', gap: 12 }}>
      {/* Module grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 12,
        padding: '0 4px',
        overflow: 'auto',
        flex: 1,
      }}>
        {modules.map((mod, idx) => {
          const color = MODULE_COLORS[idx % MODULE_COLORS.length];
          const isSelected = selectedModuleIdx === idx;
          const isExpanded = expandedIdx === idx;
          const deps = mod.dependsOn
            .map(depId => moduleDepsMap.get(depId))
            .filter(Boolean) as BusinessModule[];

          return (
            <Card
              key={mod.id}
              hoverable
              onClick={() => {
                onModuleSelect(isSelected ? null : idx);
                setExpandedIdx(isExpanded ? null : idx);
              }}
              style={{
                background: isSelected ? `${color}18` : cardBg,
                border: `1px solid ${isSelected ? color : cardBorder}`,
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s',
                ...(isSelected ? { boxShadow: `0 0 0 1px ${color}40` } : {}),
              }}
              styles={{
                body: { padding: '12px 14px' },
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: color, flexShrink: 0,
                }} />
                <div style={{
                  color: tc.text, fontWeight: 600, fontSize: 14,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {mod.name}
                </div>
                <Badge count={mod.fileNodeIds.length} style={{ backgroundColor: color }} overflowCount={999} />
              </div>
              <div style={{ color: tc.textSecondary, fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>
                {mod.description}
              </div>
              {/* Dependencies */}
              {deps.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {deps.map(dep => {
                    const depIdx = modules.indexOf(dep);
                    const depColor = MODULE_COLORS[depIdx % MODULE_COLORS.length];
                    return (
                      <Tooltip key={dep.id} title={dep.description}>
                        <Tag
                          color={depColor}
                          style={{ margin: 0, fontSize: 11, cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onModuleSelect(depIdx);
                            setExpandedIdx(depIdx);
                          }}
                        >
                          {dep.name}
                        </Tag>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
              {/* Expanded file list */}
              {isExpanded && (
                <div style={{
                  marginTop: 10, paddingTop: 10,
                  borderTop: `1px solid ${tc.border}`,
                  maxHeight: 200, overflow: 'auto',
                }}>
                  {mod.filePaths.map(fp => (
                    <div key={fp} style={{
                      fontSize: 11, color: tc.textSecondary,
                      padding: '2px 0',
                      fontFamily: "'Fira Code', monospace",
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {fp}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Re-analyze button */}
      <div style={{ textAlign: 'center', padding: '4px 0' }}>
        <Button size="small" icon={<ApartmentOutlined />} onClick={onAnalyze}>
          重新分析
        </Button>
      </div>
    </div>
  );
}
