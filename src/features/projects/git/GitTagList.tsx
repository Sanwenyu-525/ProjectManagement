import { useState, useEffect, useCallback } from 'react';
import { Button, List, Tag, Tooltip, Empty, Spin, message, Popconfirm, Input } from 'antd';
import { PlusOutlined, DeleteOutlined, TagOutlined } from '@ant-design/icons';
import { gitApi } from '../../../api';

interface GitTag {
  name: string;
  hash: string;
  message: string;
  date: string;
}

interface GitTagListProps {
  repoPath: string;
  onSelect?: (tag: GitTag) => void;
}

export default function GitTagList({ repoPath, onSelect }: GitTagListProps) {
  const [tags, setTags] = useState<GitTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagMessage, setNewTagMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadTags = useCallback(async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const result = await gitApi.tagList(repoPath);
      setTags(Array.isArray(result) ? result : []);
    } catch (err) {
      message.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      message.warning('请输入标签名称');
      return;
    }

    setCreating(true);
    try {
      await gitApi.tagCreate(repoPath, newTagName.trim(), newTagMessage.trim() || undefined);
      message.success(`标签 '${newTagName.trim()}' 创建成功`);
      setNewTagName('');
      setNewTagMessage('');
      setShowCreateForm(false);
      loadTags();
    } catch (err) {
      message.error(String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    try {
      await gitApi.tagDelete(repoPath, tagName);
      message.success(`标签 '${tagName}' 已删除`);
      loadTags();
    } catch (err) {
      message.error(String(err));
    }
  };

  if (!repoPath) {
    return (
      <div style={{ padding: 16, color: '#9eadc0', fontSize: 13 }}>
        请先设置项目本地路径
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--color-bg-surface)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          标签 ({tags.length})
        </span>
        <Tooltip title="创建新标签">
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setShowCreateForm(!showCreateForm)}
            loading={creating}
          />
        </Tooltip>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div style={{
          padding: '12px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-card)',
        }}>
          <Input
            placeholder="标签名称 (如 v1.0.0)"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            style={{ marginBottom: 8 }}
            size="small"
          />
          <Input.TextArea
            placeholder="备注信息 (可选)"
            value={newTagMessage}
            onChange={(e) => setNewTagMessage(e.target.value)}
            rows={2}
            style={{ marginBottom: 8 }}
            size="small"
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              size="small"
              loading={creating}
              onClick={handleCreateTag}
            >
              创建
            </Button>
            <Button
              size="small"
              onClick={() => setShowCreateForm(false)}
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {/* Tag list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : tags.length === 0 ? (
          <Empty
            description="暂无标签"
            style={{ padding: 40 }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            dataSource={tags}
            renderItem={(tag) => (
              <List.Item
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                }}
                onClick={() => onSelect?.(tag)}
                actions={[
                  <Popconfirm
                    key="delete"
                    title="确定要删除这个标签吗？"
                    onConfirm={() => handleDeleteTag(tag.name)}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: '#ff4d4f' }}
                    />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={<TagOutlined style={{ fontSize: 16, color: '#6366f1' }} />}
                  title={
                    <Tag color="blue" style={{ margin: 0 }}>
                      {tag.name}
                    </Tag>
                  }
                  description={
                    <div style={{ fontSize: 12, color: '#9eadc0' }}>
                      <div>{tag.hash}</div>
                      {tag.message && (
                        <div style={{ marginTop: 4, color: 'var(--color-text-secondary)' }}>
                          {tag.message}
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
}
