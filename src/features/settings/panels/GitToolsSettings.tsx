import { useState } from 'react';
import { Input, Button, message } from 'antd';
import { SaveOutlined, UndoOutlined } from '@ant-design/icons';
import { GlassCard, CardHeader, ToggleRow } from '../settingsComponents';

export default function GitToolsSettings() {
  const [defaultBranch, setDefaultBranch] = useState(localStorage.getItem('devhub_git_default_branch') || 'main');
  const [commitTemplate, setCommitTemplate] = useState(localStorage.getItem('devhub_git_commit_template') || '');
  const [autoFetch, setAutoFetch] = useState(localStorage.getItem('devhub_git_auto_fetch') === 'true');
  const [verbose, setVerbose] = useState(localStorage.getItem('devhub_git_verbose') === 'true');

  const handleSave = () => {
    localStorage.setItem('devhub_git_default_branch', defaultBranch);
    localStorage.setItem('devhub_git_commit_template', commitTemplate);
    localStorage.setItem('devhub_git_auto_fetch', String(autoFetch));
    localStorage.setItem('devhub_git_verbose', String(verbose));
    message.success('Git 设置已保存');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <CardHeader title="Git 设置" />
        <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>默认分支名</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>新项目初始化时使用的默认分支名</div>
            <Input
              value={defaultBranch}
              onChange={e => setDefaultBranch(e.target.value)}
              placeholder="main"
              style={{ width: 220 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>提交模板</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>默认的 commit message 模板</div>
            <Input.TextArea
              value={commitTemplate}
              onChange={e => setCommitTemplate(e.target.value)}
              placeholder={"feat: \n\n描述变更内容"}
              rows={3}
              style={{ fontFamily: "'Fira Code', monospace", fontSize: 'var(--text-sm)' }}
            />
          </div>

          <ToggleRow
            label="自动 Fetch"
            description="后台定期从远程仓库获取最新状态"
            checked={autoFetch}
            onChange={() => setAutoFetch(!autoFetch)}
          />

          <ToggleRow
            label="详细日志"
            description="显示详细的 git 操作日志输出"
            checked={verbose}
            onChange={() => setVerbose(!verbose)}
          />
        </div>
      </GlassCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button
          icon={<UndoOutlined />}
          onClick={() => {
            setDefaultBranch('main');
            setCommitTemplate('');
            setAutoFetch(false);
            setVerbose(false);
            localStorage.removeItem('devhub_git_default_branch');
            localStorage.removeItem('devhub_git_commit_template');
            localStorage.removeItem('devhub_git_auto_fetch');
            localStorage.removeItem('devhub_git_verbose');
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
