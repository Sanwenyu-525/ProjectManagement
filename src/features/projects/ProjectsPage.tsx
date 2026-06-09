import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Select, Row, Col, Tag, Space, Modal, Form, message, Empty, Spin, Divider, Alert, Table, InputNumber } from 'antd';
import { PlusOutlined, SearchOutlined, FolderOpenOutlined, ScanOutlined, LinkOutlined, FolderOutlined, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { projectsApi, detectApi } from '../../api';
import ProjectIcon from '../../shared/ProjectIcon';
import { STATUS_COLORS, PROJECT_STATUSES, PRIORITY_OPTIONS } from '../../lib/constants';

const STATUS_OPTIONS = [...PROJECT_STATUSES];
const SOURCE_OPTIONS = [
  { value: 'Local', label: '本地项目' },
  { value: 'Remote', label: '远程项目' },
  { value: 'Hybrid', label: '混合项目' },
];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<any>(null);

  // Scan directory state
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanPath, setScanPath] = useState('');
  const [scanMaxDepth, setScanMaxDepth] = useState(1);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [scanGroups, setScanGroups] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [importing, setImporting] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await projectsApi.list(params);
      setProjects(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleDetect = async () => {
    const localPath = form.getFieldValue('localPath')?.trim();
    const repoUrl = form.getFieldValue('repoUrl')?.trim();

    if (!localPath && !repoUrl) {
      message.warning('请输入本地路径或 Git 仓库地址');
      return;
    }

    setDetecting(true);
    setDetectResult(null);

    try {
      let result: any;
      if (repoUrl) {
        result = await detectApi.gitRepo(repoUrl);
      } else {
        result = await detectApi.local(localPath);
      }

      setDetectResult(result);

      // Auto-fill form fields
      const updates: Record<string, any> = {};
      if (result.name) updates.name = result.name;
      if (result.description) updates.description = result.description;
      if (result.techStack?.length) updates.techStack = result.techStack.join(', ');
      if (result.source) updates.source = result.source;
      if (result.localPath) updates.localPath = result.localPath;
      if (result.repoUrl) updates.repoUrl = result.repoUrl;
      if (result.openCommand) updates.openCommand = result.openCommand;
      form.setFieldsValue(updates);

      message.success(`检测完成，识别到 ${result.techStack?.length || 0} 项技术栈`);
    } catch (err: unknown) {
      message.error(`检测失败: ${String(err)}`);
    } finally {
      setDetecting(false);
    }
  };

  const handleCreate = async (values: any) => {
    // Prompt user to set openCommand if localPath is set but no command configured
    if (values.localPath?.trim() && !values.openCommand?.trim()) {
      const proceed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '设置启动命令',
          content: '检测到项目路径但未设置启动命令，设置后可一键启动项目开发。是否现在设置？',
          okText: '去设置',
          cancelText: '跳过，用默认',
          onOk: () => resolve(false),
          onCancel: () => resolve(true),
        });
      });
      if (!proceed) {
        // Focus the openCommand field
        form.scrollToField('openCommand');
        return;
      }
    }

    try {
      const payload: Record<string, any> = {
        ...values,
        techStack: values.techStack ? values.techStack.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      };
      delete payload.repoUrl; // Not a project field, used only for detect
      await projectsApi.create(payload);
      message.success('项目创建成功');
      setModalOpen(false);
      form.resetFields();
      setDetectResult(null);
      loadProjects();
    } catch (err: unknown) {
      message.error(String(err) || '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，确认要删除该项目吗？',
      okType: 'danger',
      onOk: async () => {
        await projectsApi.delete(id);
        message.success('已删除');
        loadProjects();
      },
    });
  };

  const openModal = () => {
    setDetectResult(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleBrowseFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true });
      if (selected) {
        setScanPath(selected as string);
      }
    } catch (err) {
      message.error('无法打开文件夹选择器');
    }
  };

  const handleScan = async () => {
    if (!scanPath.trim()) {
      message.warning('请输入或选择扫描路径');
      return;
    }
    setScanning(true);
    setScanResults([]);
    setScanGroups([]);
    setSelectedKeys([]);
    try {
      const result = await detectApi.scanDirectory(scanPath.trim(), scanMaxDepth) as any;
      const projects = result.projects || [];
      const groups = result.groups || [];
      setScanResults(projects);
      setScanGroups(groups);
      if (projects.length === 0) {
        message.info('未发现任何项目');
      } else {
        const groupedCount = projects.filter((p: any) => p.groupId).length;
        message.success(`发现 ${projects.length} 个项目${groupedCount > 0 ? `，其中 ${groupedCount} 个存在关联` : ''}`);
      }
    } catch (err) {
      message.error(`扫描失败: ${String(err)}`);
    } finally {
      setScanning(false);
    }
  };

  const handleImportSelected = async () => {
    if (selectedKeys.length === 0) {
      message.warning('请先选择要导入的项目');
      return;
    }
    setImporting(true);
    const results = await Promise.allSettled(
      selectedKeys.map((key) => {
        const project = scanResults[Number(key)];
        if (!project) return Promise.reject();
        return projectsApi.create({
          name: project.name,
          description: project.description,
          techStack: project.techStack,
          source: project.source,
          localPath: project.localPath,
          openCommand: project.openCommand,
          priority: 'Medium',
        });
      })
    );
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;
    setImporting(false);
    if (successCount > 0) {
      message.success(`成功导入 ${successCount} 个项目${failCount > 0 ? `，${failCount} 个失败` : ''}`);
      setScanModalOpen(false);
      setScanResults([]);
      setSelectedKeys([]);
      loadProjects();
    } else {
      message.error('导入失败');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>项目管理</h2>
        <Space>
          <Button icon={<ScanOutlined />} onClick={() => setScanModalOpen(true)}>
            扫描目录
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openModal}>
            新建项目
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="搜索项目..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
        <Select
          placeholder="按状态筛选"
          value={statusFilter}
          onChange={setStatusFilter}
          allowClear
          style={{ width: 160 }}
          options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))}
        />
      </Space>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : projects.length === 0 ? (
        <Empty description="暂无项目" />
      ) : (
        <Row gutter={[16, 16]}>
          {projects.map(project => (
            <Col key={project.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                onDoubleClick={() => projectsApi.open(project.id).then(() => message.success('正在启动项目...')).catch((e: unknown) => message.warning(String(e) || '启动失败'))}
                onClick={() => navigate(`/projects/${project.id}`)}
                style={{ borderRadius: 8, position: 'relative' }}
              >
                {/* 右上角操作按钮 */}
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  <PlayCircleOutlined
                    style={{
                      fontSize: 18,
                      color: '#8b95a5',
                      cursor: 'pointer',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#52c41a')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#8b95a5')}
                    onClick={(e) => {
                      e.stopPropagation();
                      projectsApi.open(project.id)
                        .then(() => message.success('正在启动项目...'))
                        .catch((err: unknown) => message.warning(String(err) || '启动失败'));
                    }}
                  />
                  <DeleteOutlined
                    style={{
                      fontSize: 18,
                      color: '#8b95a5',
                      cursor: 'pointer',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4d4f')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#8b95a5')}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(project.id);
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <ProjectIcon
                    name={project.name}
                    techStack={project.techStack}
                    iconType={project.iconType}
                    iconUrl={project.iconUrl}
                    iconColor={project.iconColor}
                    size={48}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {project.name}
                    </div>
                    <Tag color={STATUS_COLORS[project.status]} style={{ marginTop: 4 }}>{project.status}</Tag>
                  </div>
                </div>
                {project.description && (
                  <div style={{ color: '#6b7a99', fontSize: 13, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {project.description}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {project.techStack?.slice(0, 3).map((t: string) => <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>)}
                  {project.remoteRepos?.length > 0 && (
                    <Tag color="blue">{project.remoteRepos.length} 仓库</Tag>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 新建项目弹窗 */}
      <Modal
        title="新建项目"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setDetectResult(null); }}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          {/* 自动检测区域 */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px dashed rgba(99, 102, 241, 0.3)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
              <ScanOutlined style={{ marginRight: 6 }} />
              自动检测
            </div>
            <Row gutter={8}>
              <Col flex="auto">
                <Form.Item name="localPath" style={{ marginBottom: 8 }}>
                  <Input
                    placeholder="本地路径，如 D:\Projects\my-app"
                    prefix={<FolderOpenOutlined />}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={8}>
              <Col flex="auto">
                <Form.Item name="repoUrl" style={{ marginBottom: 8 }}>
                  <Input
                    placeholder="Git 仓库地址，如 https://github.com/user/repo"
                    prefix={<LinkOutlined />}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Button
              type="primary"
              ghost
              icon={<ScanOutlined />}
              loading={detecting}
              onClick={handleDetect}
              block
            >
              {detecting ? '正在检测...' : '一键检测项目信息'}
            </Button>

            {detectResult && (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 8 }}
                message={
                  <span>
                    检测完成：
                    {detectResult.name && <Tag color="blue">{detectResult.name}</Tag>}
                    {detectResult.techStack?.map((t: string) => <Tag key={t}>{t}</Tag>)}
                    {detectResult.repoPlatform && <Tag color="green">{detectResult.repoPlatform}</Tag>}
                  </span>
                }
              />
            )}
          </div>

          <Divider style={{ margin: '12px 0' }}>项目信息</Divider>

          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="我的项目" />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea rows={2} placeholder="简要描述项目..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="source" label="项目来源" initialValue="Local">
                <Select options={SOURCE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="优先级" initialValue="Medium">
                <Select options={PRIORITY_OPTIONS.map(p => ({ value: p, label: p }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="openCommand" label="启动命令" tooltip="检测后自动填充，支持 {path} 占位符">
            <Input placeholder="如 npm run dev（检测后自动填充）" />
          </Form.Item>
          <Form.Item name="techStack" label="技术栈（逗号分隔）">
            <Input placeholder="React, TypeScript, Node.js（检测后自动填充）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 扫描目录弹窗 */}
      <Modal
        title="扫描目录"
        open={scanModalOpen}
        onCancel={() => { setScanModalOpen(false); setScanResults([]); setScanGroups([]); setSelectedKeys([]); }}
        footer={null}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Row gutter={8} align="middle">
            <Col flex="auto">
              <Input
                placeholder="输入目录路径，如 D:\Develop"
                value={scanPath}
                onChange={e => setScanPath(e.target.value)}
                prefix={<FolderOpenOutlined />}
              />
            </Col>
            <Col>
              <Button icon={<FolderOutlined />} onClick={handleBrowseFolder}>
                浏览
              </Button>
            </Col>
            <Col>
              <InputNumber
                min={1}
                max={5}
                value={scanMaxDepth}
                onChange={v => setScanMaxDepth(v ?? 1)}
                addonBefore="深度"
                style={{ width: 100 }}
              />
            </Col>
            <Col>
              <Button type="primary" icon={<ScanOutlined />} loading={scanning} onClick={handleScan}>
                {scanning ? '扫描中...' : '开始扫描'}
              </Button>
            </Col>
          </Row>
        </div>

        {scanResults.length > 0 && (
          <>
            {scanGroups.length > 0 && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(99, 102, 241, 0.06)', borderRadius: 6, fontSize: 13 }}>
                <span style={{ marginRight: 12, color: '#6b7a99' }}>关联关系：</span>
                {scanGroups.map(g => (
                  <Tag
                    key={g.id}
                    color={g.groupType === 'git' ? 'blue' : 'orange'}
                    style={{ marginRight: 8 }}
                  >
                    {g.groupType === 'git' ? '🔗 同仓库' : '📁 嵌套'} {g.label}
                  </Tag>
                ))}
              </div>
            )}
            <Table
              rowSelection={{
                selectedRowKeys: selectedKeys,
                onChange: setSelectedKeys,
              }}
              dataSource={scanResults.map((r, i) => ({ ...r, key: i }))}
              rowKey="key"
              pagination={false}
              size="small"
              scroll={{ y: 400 }}
              columns={[
                {
                  title: '项目名',
                  dataIndex: 'name',
                  width: 150,
                  ellipsis: true,
                },
                {
                  title: '路径',
                  dataIndex: 'localPath',
                  ellipsis: true,
                },
                {
                  title: '技术栈',
                  dataIndex: 'techStack',
                  width: 250,
                  render: (stack: string[]) => (
                    <Space size={2} wrap>
                      {stack?.slice(0, 4).map(t => <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>)}
                      {stack?.length > 4 && <Tag style={{ fontSize: 11 }}>+{stack.length - 4}</Tag>}
                    </Space>
                  ),
                },
                {
                  title: '来源',
                  dataIndex: 'source',
                  width: 80,
                  render: (s: string) => <Tag color={s === 'Hybrid' ? 'blue' : 'default'}>{s}</Tag>,
                },
                {
                  title: '仓库',
                  dataIndex: 'repoPlatform',
                  width: 80,
                  render: (p: string) => p ? <Tag color="green">{p}</Tag> : '-',
                },
                {
                  title: '关联',
                  dataIndex: 'groupId',
                  width: 120,
                  render: (groupId: string) => {
                    if (!groupId) return <Tag>独立</Tag>;
                    const group = scanGroups.find((g: any) => g.id === groupId);
                    const color = group?.groupType === 'git' ? 'blue' : 'orange';
                    const prefix = group?.groupType === 'git' ? '🔗' : '📁';
                    return (
                      <Tag color={color}>
                        {prefix} {group?.label || '关联'}
                      </Tag>
                    );
                  },
                },
              ]}
            />
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Space>
                <span style={{ color: '#9eadc0' }}>
                  已选择 {selectedKeys.length} / {scanResults.length} 项
                </span>
                <Button
                  type="primary"
                  loading={importing}
                  disabled={selectedKeys.length === 0}
                  onClick={handleImportSelected}
                >
                  导入选中项目
                </Button>
              </Space>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
