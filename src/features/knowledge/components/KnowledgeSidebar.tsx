import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dropdown, Modal, Input, Select, message } from 'antd';
import { useState, useCallback } from 'react';
import { knowledgeApi, notesApi, memoryApi, decisionsApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { useKnowledgeStore } from '../../../stores/knowledgeStore';
import type { MemoryType } from '../../../types';

// ── Category config ──

interface CategoryItem {
  key: string;
  label: string;
  icon: string;
  group: string;
}

interface CategoryGroup {
  title: string;
  items: CategoryItem[];
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    title: 'AI 知识',
    items: [
      { key: 'memory', label: '记忆', icon: 'smart_toy', group: 'ai' },
      { key: 'experience', label: '经验', icon: 'school', group: 'ai' },
      { key: 'prompt', label: '提示词', icon: 'psychology', group: 'ai' },
      { key: 'rule', label: '规则', icon: 'rule', group: 'ai' },
    ],
  },
  {
    title: '工程知识',
    items: [
      { key: 'architecture', label: '架构', icon: 'account_tree', group: 'engineering' },
      { key: 'pattern', label: '模式', icon: 'pattern', group: 'engineering' },
      { key: 'solution', label: '解决方案', icon: 'build', group: 'engineering' },
      { key: 'workflow', label: '工作流', icon: 'route', group: 'engineering' },
    ],
  },
  {
    title: '记录',
    items: [
      { key: 'decision', label: '决策日志', icon: 'gavel', group: 'records' },
      { key: 'document', label: '项目文档', icon: 'description', group: 'records' },
      { key: 'note', label: '个人笔记', icon: 'edit_note', group: 'records' },
    ],
  },
];

const NEW_ITEMS = [
  { key: 'import', label: '导入文件', icon: 'upload_file' },
  { key: 'memory', label: '记忆', icon: 'smart_toy' },
  { key: 'decision', label: '决策', icon: 'gavel' },
  { key: 'document', label: '文档', icon: 'description' },
  { key: 'note', label: '笔记', icon: 'edit_note' },
];

const MEMORY_TYPE_OPTIONS: { value: MemoryType; label: string }[] = [
  { value: 'architecture', label: '架构' },
  { value: 'code', label: '代码知识' },
  { value: 'bugfix', label: 'Bug 修复' },
  { value: 'rule', label: 'AI 规则' },
  { value: 'session', label: '会话摘要' },
  { value: 'solution', label: '解决方案' },
  { value: 'pattern', label: '代码模式' },
  { value: 'prompt', label: '高价值提示词' },
  { value: 'workflow', label: '开发流程' },
  { value: 'experience', label: '经验沉淀' },
];

export default function KnowledgeSidebar() {
  const selectedCategory = useKnowledgeStore(s => s.selectedCategory);
  const setSelectedCategory = useKnowledgeStore(s => s.setSelectedCategory);
  const searchQuery = useKnowledgeStore(s => s.searchQuery);
  const setSearchQuery = useKnowledgeStore(s => s.setSearchQuery);
  const setSelectedId = useKnowledgeStore(s => s.setSelectedId);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newType, setNewType] = useState<string>('memory');

  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const paths = await open({
        multiple: true,
        title: '选择文件',
        filters: [{ name: '文档', extensions: ['md', 'txt'] }],
      });
      if (!paths) return null;
      const arr = Array.isArray(paths) ? paths : [paths];
      return knowledgeApi.importFiles(arr);
    },
    onSuccess: (result) => {
      if (result) {
        queryClient.invalidateQueries({ queryKey: ['knowledge'] });
        message.success(`已导入 ${result.length} 个文件`);
      }
    },
    onError: () => message.error('导入失败'),
  });

  // Fetch counts
  const { data: countsData = [] } = useQuery({
    queryKey: queryKeys.knowledge.counts(),
    queryFn: () => knowledgeApi.counts(),
    staleTime: 10_000,
  });

  const countMap = countsData.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = item.count;
    return acc;
  }, {});

  const totalCount = countsData.reduce((sum, item) => sum + item.count, 0);

  const handleSelect = useCallback((category: string | null) => {
    setSelectedCategory(category);
    setSelectedId(null);
  }, [setSelectedCategory, setSelectedId]);

  const handleNewClick = useCallback((type: string) => {
    if (type === 'import') {
      importMutation.mutate();
      return;
    }
    setNewType(type);
    setShowNewModal(true);
  }, [importMutation]);

  return (
    <div style={styles.sidebar}>
      {/* Search */}
      <div style={styles.searchBox}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-outline)' }}>
          search
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="搜索知识..."
          aria-label="搜索知识"
          style={styles.searchInput}
        />
        {searchQuery && (
          <span
            className="material-symbols-outlined"
            role="button"
            aria-label="清除搜索"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSearchQuery(''); } }}
            style={{ fontSize: 14, color: 'var(--md-outline)', cursor: 'pointer', padding: 4, borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setSearchQuery('')}
          >close</span>
        )}
      </div>

      {/* Navigation */}
      <div style={styles.navArea}>
        {/* Top items */}
        <div style={styles.navGroup}>
          <NavItem
            icon="star"
            label="收藏"
            count={null}
            active={selectedCategory === '_pinned'}
            onClick={() => handleSelect('_pinned')}
          />
          <NavItem
            icon="apps"
            label="全部"
            count={totalCount}
            active={selectedCategory === null}
            onClick={() => handleSelect(null)}
          />
        </div>

        <div style={styles.divider} />

        {/* Category groups */}
        {CATEGORY_GROUPS.map((group, gi) => (
          <div key={group.title}>
            {gi > 0 && <div style={styles.divider} />}
            <div style={styles.groupLabel}>{group.title}</div>
            <div style={styles.navGroup}>
              {group.items.map(item => (
                <NavItem
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  count={countMap[item.key] ?? 0}
                  active={selectedCategory === item.key}
                  onClick={() => handleSelect(item.key)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom action */}
      <div style={styles.bottomBar}>
        <Dropdown
          menu={{
            items: NEW_ITEMS.map(item => ({
              key: item.key,
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{item.icon}</span>
                  新建{item.label}
                </span>
              ),
              onClick: () => handleNewClick(item.key),
            })),
          }}
          trigger={['click']}
        >
          <button style={styles.newBtn}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            新建知识
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
          </button>
        </Dropdown>
      </div>

      {/* Create modals */}
      <CreateModal
        open={showNewModal}
        type={newType}
        onClose={() => setShowNewModal(false)}
      />
    </div>
  );
}

// ── NavItem ──

function NavItem({ icon, label, count, active, onClick, unicode }: {
  icon: string;
  label: string;
  count: number | null;
  active: boolean;
  onClick: () => void;
  unicode?: boolean;
}) {
  return (
    <button
      aria-current={active ? 'true' : undefined}
      style={{
        ...styles.navItem,
        ...(active ? styles.navItemActive : {}),
      }}
      onClick={onClick}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--color-primary-light)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <span
        className={unicode ? undefined : "material-symbols-outlined"}
        style={{ fontSize: 18, color: active ? 'var(--md-primary)' : 'var(--md-outline)', flexShrink: 0 }}
      >{icon}</span>
      <span style={{
        ...styles.navLabel,
        color: active ? 'var(--md-primary)' : 'var(--md-on-surface)',
        fontWeight: active ? 600 : 400,
      }}>{label}</span>
      {count !== null && count > 0 && (
        <span style={{
          ...styles.badge,
          ...(active ? styles.badgeActive : {}),
        }}>{count}</span>
      )}
    </button>
  );
}

// ── Create Modal ──

function CreateModal({ open, type, onClose }: {
  open: boolean;
  type: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [memoryType, setMemoryType] = useState<MemoryType>('session');

  const handleClose = useCallback(() => {
    setTitle('');
    setContent('');
    setMemoryType('session');
    onClose();
  }, [onClose]);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) {
      message.warning('请填写标题');
      return;
    }
    try {
      if (type === 'memory') {
        await memoryApi.create({
          memoryType,
          title: title.trim(),
          content: content.trim(),
          source: 'manual',
        });
        message.success('记忆已创建');
      } else if (type === 'decision') {
        await decisionsApi.create({
          title: title.trim(),
          reason: content.trim(),
        });
        message.success('决策已记录');
      } else if (type === 'note') {
        await notesApi.create({
          title: title.trim(),
          content: content.trim(),
        });
        message.success('笔记已创建');
      }
      handleClose();
    } catch {
      message.error('创建失败');
    }
  }, [type, title, content, memoryType, handleClose]);

  const titles: Record<string, string> = {
    memory: '新建记忆',
    decision: '记录决策',
    document: '新建文档',
    note: '新建笔记',
  };

  return (
    <Modal
      title={titles[type] ?? '新建'}
      open={open}
      onOk={handleCreate}
      onCancel={handleClose}
      okText="创建"
      cancelText="取消"
      width={480}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {type === 'memory' && (
          <div>
            <label style={styles.modalLabel}>类型</label>
            <Select
              value={memoryType}
              onChange={setMemoryType}
              style={{ width: '100%' }}
              options={MEMORY_TYPE_OPTIONS}
            />
          </div>
        )}
        <div>
          <label style={styles.modalLabel}>标题</label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="简短描述"
          />
        </div>
        <div>
          <label style={styles.modalLabel}>内容</label>
          <Input.TextArea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="详细描述..."
            rows={4}
          />
        </div>
      </div>
    </Modal>
  );
}

// ── Styles ──

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 240,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    borderRight: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 12px',
    borderBottom: '1px solid var(--color-border-subtle)',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 13,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)',
  },
  navArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  navGroup: {
    padding: '2px 8px',
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    fontFamily: 'var(--font-label)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '8px 12px 4px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 12px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background 0.15s',
    fontFamily: 'var(--font-sans)',
    textAlign: 'left',
  },
  navItemActive: {
    background: 'var(--color-primary-light)',
  },
  navLabel: {
    fontSize: 13,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badge: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    background: 'var(--md-surface-container-low)',
    padding: '1px 6px',
    borderRadius: 8,
    fontFamily: 'var(--font-label)',
  },
  badgeActive: {
    color: 'var(--md-primary)',
    background: 'var(--color-primary-light)',
  },
  divider: {
    height: 1,
    background: 'var(--color-divider)',
    margin: '4px 12px',
  },
  bottomBar: {
    padding: '8px 12px',
    borderTop: '1px solid var(--color-border-subtle)',
    flexShrink: 0,
  },
  newBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    height: 34,
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--md-on-primary)',
    background: 'var(--md-primary)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  modalLabel: {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginBottom: 4,
  },
};
