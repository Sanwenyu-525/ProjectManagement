import { useState } from 'react';
import { Button, Select, message } from 'antd';
import { SaveOutlined, UndoOutlined } from '@ant-design/icons';
import { GlassCard, CardHeader, ToggleRow } from '../settingsComponents';
import { COMMANDS_WITH_SHORTCUTS, CATEGORY_LABELS } from '../../../lib/commands';

export default function WorkspaceSettings() {
  const [defaultLayout, setDefaultLayout] = useState(localStorage.getItem('devhub_workspace_default_layout') || 'agent-terminal');
  const [showHidden, setShowHidden] = useState(localStorage.getItem('devhub_show_hidden_files') === 'true');
  const [fileSort, setFileSort] = useState(localStorage.getItem('devhub_file_sort') || 'name');

  const handleSave = () => {
    localStorage.setItem('devhub_workspace_default_layout', defaultLayout);
    localStorage.setItem('devhub_show_hidden_files', String(showHidden));
    localStorage.setItem('devhub_file_sort', fileSort);
    message.success('工作区设置已保存');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <CardHeader title="工作区设置" />
        <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>默认面板布局</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>启动工作区时的初始面板排列</div>
            <Select
              value={defaultLayout}
              onChange={setDefaultLayout}
              style={{ width: 260 }}
              options={[
                { value: 'agent-terminal', label: 'Agent + 终端' },
                { value: 'editor-only', label: '仅编辑器' },
                { value: 'full-width', label: '全宽布局' },
              ]}
            />
          </div>

          <ToggleRow
            label="显示隐藏文件"
            description="在文件浏览器中显示以 . 开头的文件和文件夹"
            checked={showHidden}
            onChange={() => setShowHidden(!showHidden)}
          />

          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>文件排序方式</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>文件浏览器中的默认排序</div>
            <Select
              value={fileSort}
              onChange={setFileSort}
              style={{ width: 220 }}
              options={[
                { value: 'name', label: '按名称' },
                { value: 'modified', label: '按修改时间' },
                { value: 'size', label: '按大小' },
              ]}
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <CardHeader title="快捷键" badge="只读" />
        <div style={{ padding: '16px 24px 20px' }}>
          <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
            当前快捷键列表（不可自定义）
          </div>
          {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
            const cmds = COMMANDS_WITH_SHORTCUTS.filter(c => c.category === cat);
            if (cmds.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--md-on-surface-variant)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {label}
                </div>
                {cmds.map(cmd => (
                  <div key={cmd.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface)' }}>{cmd.label}</span>
                    <kbd style={{
                      fontSize: 10, color: 'var(--md-on-surface-variant)',
                      background: 'var(--md-surface-container-high)',
                      padding: '2px 6px', borderRadius: 4,
                      border: '1px solid var(--border)',
                      fontFamily: "'Fira Code', monospace",
                    }}>
                      {cmd.shortcut}
                    </kbd>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </GlassCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button
          icon={<UndoOutlined />}
          onClick={() => {
            setDefaultLayout('agent-terminal');
            setShowHidden(false);
            setFileSort('name');
            localStorage.removeItem('devhub_workspace_default_layout');
            localStorage.removeItem('devhub_show_hidden_files');
            localStorage.removeItem('devhub_file_sort');
            message.info('已重置为默认值');
          }}
        >
          重置默认
        </Button>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存设置</Button>
      </div>
    </div>
  );
}
