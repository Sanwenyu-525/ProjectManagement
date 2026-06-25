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
  useProject,
} from '../../../hooks/useProjects';
import { classifyBusinessModules } from '../../../lib/graphClassifier';
import type { GraphSummary, FeatureGroup, SuggestedGroup, BusinessModule } from '../../../types';
import BusinessGraphView from './BusinessGraphView';
import ImpactView from './ImpactView';
import CallChainView from './CallChainView';
import LayersView from './LayersView';
import { useComputeLayers } from '../../../hooks/useProjects';
import {
  LAYOUT_OPTIONS, VIEW_OPTIONS, LANGUAGE_COLORS, GROUP_PALETTE,
  buildGraphOption,
} from './graphLayouts';
import type { LayoutType, ViewMode, GroupColorInfo } from './graphLayouts';

// ── Layout position computation ──

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

  // View mode & AI classification
  const [viewMode, setViewMode] = useState<ViewMode>('business');
  const [aiModules, setAiModules] = useState<BusinessModule[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedModuleIdx, setSelectedModuleIdx] = useState<number | null>(null);
  const { data: project } = useProject(projectId);
  const { data: layerResult, isLoading: layersLoading } = useComputeLayers(projectId);

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

  const handleAiAnalyze = async () => {
    if (!graphData || !project?.localPath) {
      message.error('无法获取项目路径');
      return;
    }
    setAiLoading(true);
    try {
      const result = await classifyBusinessModules(graphData, projectId, project.localPath);
      setAiModules(result.modules);
      message.success(`AI 识别出 ${result.modules.length} 个业务模块`);
    } catch (err) {
      message.error(`AI 分析失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setAiLoading(false);
    }
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
          {hasData && viewMode === 'dependency' && (
            <Button
              icon={<GroupOutlined />}
              type={groupsPanelOpen ? 'primary' : 'default'}
              onClick={() => setGroupsPanelOpen(!groupsPanelOpen)}
            >
              功能组
            </Button>
          )}
          {hasData && (
            <Segmented
              options={VIEW_OPTIONS}
              value={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
              size="small"
            />
          )}
          {hasData && viewMode === 'dependency' && (
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

      {/* Main area: view-dependent content */}
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
      ) : viewMode === 'business' ? (
        <BusinessGraphView
          graphData={graphData}
          modules={aiModules}
          loading={aiLoading}
          onAnalyze={handleAiAnalyze}
          selectedModuleIdx={selectedModuleIdx}
          onModuleSelect={setSelectedModuleIdx}
        />
      ) : viewMode === 'impact' ? (
        <ImpactView graphData={graphData} projectId={projectId} project={project} />
      ) : viewMode === 'callchain' ? (
        <CallChainView graphData={graphData} projectId={projectId} project={project} />
      ) : viewMode === 'architecture' ? (
        <LayersView graphData={graphData} layerResult={layerResult} isLoading={layersLoading} project={project} />
      ) : (
        <div style={{ display: 'flex', flex: 1, minHeight: 400, gap: 0 }}>
          {/* Graph */}
          <div style={{ flex: 1, minHeight: 400 }}>
            <ReactECharts
              option={option!}
              style={{ height: '100%', minHeight: 400 }}
              opts={{ renderer: 'canvas' }}
              notMerge={true}
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
